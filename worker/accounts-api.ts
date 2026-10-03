import { neon } from '@neondatabase/serverless';
import {
  clearSessionCookieHeader,
  constantTimeEqual,
  createSessionToken,
  generateResetCode,
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeResetCode,
  readSessionCookie,
  sessionCookieHeader,
  verifyPassword,
  verifySessionToken,
} from './auth';
import { resetCodeEmailHtml, sendEmail } from './email';

export interface AccountsEnv {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  ADMIN_KEY: string;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
}

interface UserRow {
  id: string;
  username: string;
  name: string;
  last_name: string | null;
  patronymic: string | null;
  email: string | null;
  avatar: string | null;
  phone: string | null;
  password_hash: string;
  password_salt: string;
}

// Защита от аномально большого значения, даже если клиент почему-то не сжал
// фото (см. utils/imageResize.ts) — обычное сжатое превью укладывается в
// несколько десятков КБ, этого с большим запасом хватает.
const MAX_AVATAR_LENGTH = 400_000;

interface UserRowWithResetCode {
  id: string;
  username: string;
  name: string;
  reset_code_hash: string | null;
  reset_code_salt: string | null;
  reset_code_expires_at: string | null;
}

const RESET_CODE_TTL_MS = 15 * 60 * 1000;

function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60;
}

// Пустая строка допустима (убрать номер) — иначе только цифры/+/-/()/пробелы,
// без привязки к конкретной стране (пользователи РК/РФ и т.д.).
function isValidPhone(phone: string): boolean {
  return phone.length === 0 || (phone.length <= 32 && /^[0-9+()\-\s]+$/.test(phone));
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}

async function currentUserId(request: Request, env: AccountsEnv): Promise<string | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  return verifySessionToken(token, env.SESSION_SECRET);
}

function makeId(): string {
  return crypto.randomUUID();
}

export async function handleAccountsApi(request: Request, env: AccountsEnv, url: URL): Promise<Response | null> {
  const sql = neon(env.DATABASE_URL);

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { name?: string; username?: string; password?: string; email?: string };
    const name = (body.name ?? '').trim();
    const username = (body.username ?? '').trim();
    const email = (body.email ?? '').trim();
    if (!isValidName(name)) {
      return json({ error: 'Введите имя' }, 400);
    }
    if (!isValidUsername(username)) {
      return json({ error: 'Логин: 3-32 символа, латиница/цифры/._-' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Введите корректную почту' }, 400);
    }
    if (!isValidPassword(body.password ?? '')) {
      return json({ error: 'Пароль: минимум 6 символов' }, 400);
    }
    const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existing.length > 0) {
      return json({ error: 'Этот логин уже занят' }, 409);
    }
    const { hash, salt } = await hashPassword(body.password!);
    const id = makeId();
    const createdAt = new Date().toISOString();
    await sql`
      INSERT INTO users (id, username, name, email, password_hash, password_salt, created_at)
      VALUES (${id}, ${username}, ${name}, ${email}, ${hash}, ${salt}, ${createdAt})
    `;
    const token = await createSessionToken(id, env.SESSION_SECRET);
    return json(
      { ok: true, username, name, lastName: null, patronymic: null, email, avatar: null, phone: null, createdAt },
      200,
      { 'Set-Cookie': sessionCookieHeader(token) },
    );
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
    const username = (body.username ?? '').trim();
    const rows = (await sql`
      SELECT id, username, name, last_name, patronymic, email, avatar, phone, password_hash, password_salt, created_at FROM users WHERE username = ${username}
    `) as Array<UserRow & { created_at: string }>;
    const user = rows[0] ?? null;
    if (!user || !(await verifyPassword(body.password ?? '', user.password_hash, user.password_salt))) {
      return json({ error: 'Неверный логин или пароль' }, 401);
    }
    const token = await createSessionToken(user.id, env.SESSION_SECRET);
    return json(
      {
        ok: true,
        username: user.username,
        name: user.name,
        lastName: user.last_name,
        patronymic: user.patronymic,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        createdAt: user.created_at,
      },
      200,
      { 'Set-Cookie': sessionCookieHeader(token) },
    );
  }

  // Восстановление пароля по коду с почты — двухшаговое: сперва запрос кода
  // (request-reset), потом подтверждение кодом + новый пароль (confirm-reset).
  // Код живёт RESET_CODE_TTL_MS, хранится на сервере только в виде хэша.
  if (url.pathname === '/api/auth/request-reset' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { username?: string };
    const username = (body.username ?? '').trim();
    const rows = (await sql`SELECT id, name, email FROM users WHERE username = ${username}`) as Array<{
      id: string;
      name: string;
      email: string | null;
    }>;
    const user = rows[0] ?? null;
    if (!user) {
      return json({ error: 'Такого логина нет' }, 404);
    }
    if (!user.email) {
      return json({ error: 'Для этого аккаунта не привязана почта. Войдите с устройства, где сессия ещё активна, и добавьте почту в Настройках.' }, 400);
    }
    const code = generateResetCode();
    const { hash, salt } = await hashPassword(code);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    await sql`
      UPDATE users SET reset_code_hash = ${hash}, reset_code_salt = ${salt}, reset_code_expires_at = ${expiresAt} WHERE id = ${user.id}
    `;
    try {
      await sendEmail(
        { apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: 'Мои финансы' },
        user.email,
        'Код восстановления пароля — Мои финансы',
        resetCodeEmailHtml(code, user.name),
      );
    } catch {
      return json({ error: 'Не удалось отправить письмо, попробуйте позже' }, 502);
    }
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/confirm-reset' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { username?: string; code?: string; newPassword?: string };
    const username = (body.username ?? '').trim();
    const code = normalizeResetCode(body.code ?? '');
    if (!isValidPassword(body.newPassword ?? '')) {
      return json({ error: 'Пароль: минимум 6 символов' }, 400);
    }
    const rows = (await sql`
      SELECT id, username, name, reset_code_hash, reset_code_salt, reset_code_expires_at, created_at FROM users WHERE username = ${username}
    `) as Array<UserRowWithResetCode & { created_at: string }>;
    const user = rows[0] ?? null;
    if (!user || !user.reset_code_hash || !user.reset_code_salt || !user.reset_code_expires_at) {
      return json({ error: 'Неверный код или логин' }, 401);
    }
    if (new Date(user.reset_code_expires_at).getTime() < Date.now()) {
      return json({ error: 'Код истёк — запросите новый' }, 401);
    }
    const codeValid = await verifyPassword(code, user.reset_code_hash, user.reset_code_salt);
    if (!codeValid) {
      return json({ error: 'Неверный код или логин' }, 401);
    }
    const { hash, salt } = await hashPassword(body.newPassword!);
    await sql`
      UPDATE users SET password_hash = ${hash}, password_salt = ${salt}, reset_code_hash = NULL, reset_code_salt = NULL, reset_code_expires_at = NULL
      WHERE id = ${user.id}
    `;
    const token = await createSessionToken(user.id, env.SESSION_SECRET);
    return json(
      { ok: true, username: user.username, name: user.name, createdAt: user.created_at },
      200,
      { 'Set-Cookie': sessionCookieHeader(token) },
    );
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookieHeader() });
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const rows = (await sql`SELECT username, name, last_name, patronymic, email, avatar, phone, created_at FROM users WHERE id = ${userId}`) as Array<{
      username: string;
      name: string;
      last_name: string | null;
      patronymic: string | null;
      email: string | null;
      avatar: string | null;
      phone: string | null;
      created_at: string;
    }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'not authenticated' }, 401);
    return json({
      username: user.username,
      name: user.name,
      lastName: user.last_name,
      patronymic: user.patronymic,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone,
      createdAt: user.created_at,
    });
  }

  // Имя/фамилия/отчество обновляются вместе одним вызовом — на странице
  // профиля это три отдельных поля, но сохраняются атомарно. Фамилия и
  // отчество необязательны (NULL, если пусто), имя — обязательно.
  if (url.pathname === '/api/auth/name' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { name?: string; lastName?: string; patronymic?: string };
    const name = (body.name ?? '').trim();
    const lastName = (body.lastName ?? '').trim();
    const patronymic = (body.patronymic ?? '').trim();
    if (!isValidName(name)) {
      return json({ error: 'Введите имя' }, 400);
    }
    if (lastName.length > 60 || patronymic.length > 60) {
      return json({ error: 'Слишком длинное значение' }, 400);
    }
    const rows = (await sql`SELECT username, email, avatar, phone, created_at FROM users WHERE id = ${userId}`) as Array<{
      username: string;
      email: string | null;
      avatar: string | null;
      phone: string | null;
      created_at: string;
    }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'not authenticated' }, 401);
    const lastNameValue = lastName.length > 0 ? lastName : null;
    const patronymicValue = patronymic.length > 0 ? patronymic : null;
    await sql`UPDATE users SET name = ${name}, last_name = ${lastNameValue}, patronymic = ${patronymicValue} WHERE id = ${userId}`;
    return json({
      username: user.username,
      name,
      lastName: lastNameValue,
      patronymic: patronymicValue,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone,
      createdAt: user.created_at,
    });
  }

  if (url.pathname === '/api/auth/email' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = (body.email ?? '').trim();
    if (!isValidEmail(email)) {
      return json({ error: 'Введите корректную почту' }, 400);
    }
    const rows = (await sql`SELECT username, name, last_name, patronymic, avatar, phone, created_at FROM users WHERE id = ${userId}`) as Array<{
      username: string;
      name: string;
      last_name: string | null;
      patronymic: string | null;
      avatar: string | null;
      phone: string | null;
      created_at: string;
    }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'not authenticated' }, 401);
    await sql`UPDATE users SET email = ${email} WHERE id = ${userId}`;
    return json({
      username: user.username,
      name: user.name,
      lastName: user.last_name,
      patronymic: user.patronymic,
      email,
      avatar: user.avatar,
      phone: user.phone,
      createdAt: user.created_at,
    });
  }

  if (url.pathname === '/api/auth/phone' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { phone?: string };
    const phone = (body.phone ?? '').trim();
    if (!isValidPhone(phone)) {
      return json({ error: 'Введите корректный номер телефона' }, 400);
    }
    const rows = (await sql`SELECT username, name, last_name, patronymic, email, avatar, created_at FROM users WHERE id = ${userId}`) as Array<{
      username: string;
      name: string;
      last_name: string | null;
      patronymic: string | null;
      email: string | null;
      avatar: string | null;
      created_at: string;
    }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'not authenticated' }, 401);
    const phoneValue = phone.length > 0 ? phone : null;
    await sql`UPDATE users SET phone = ${phoneValue} WHERE id = ${userId}`;
    return json({
      username: user.username,
      name: user.name,
      lastName: user.last_name,
      patronymic: user.patronymic,
      email: user.email,
      avatar: user.avatar,
      phone: phoneValue,
      createdAt: user.created_at,
    });
  }

  if (url.pathname === '/api/auth/avatar' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { avatar?: string | null };
    const avatar = body.avatar ?? null;
    if (avatar !== null) {
      if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
        return json({ error: 'Некорректное изображение' }, 400);
      }
      if (avatar.length > MAX_AVATAR_LENGTH) {
        return json({ error: 'Фото слишком большое' }, 400);
      }
    }
    const rows = (await sql`SELECT username, name, last_name, patronymic, email, phone, created_at FROM users WHERE id = ${userId}`) as Array<{
      username: string;
      name: string;
      last_name: string | null;
      patronymic: string | null;
      email: string | null;
      phone: string | null;
      created_at: string;
    }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'not authenticated' }, 401);
    await sql`UPDATE users SET avatar = ${avatar} WHERE id = ${userId}`;
    return json({
      username: user.username,
      name: user.name,
      lastName: user.last_name,
      patronymic: user.patronymic,
      email: user.email,
      avatar,
      phone: user.phone,
      createdAt: user.created_at,
    });
  }

  if (url.pathname === '/api/data' && request.method === 'GET') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const rows = (await sql`SELECT snapshot, updated_at FROM user_data WHERE user_id = ${userId}`) as Array<{
      snapshot: string;
      updated_at: string;
    }>;
    const row = rows[0] ?? null;
    if (!row) return json({ snapshot: null, updatedAt: null });
    return json({ snapshot: JSON.parse(row.snapshot), updatedAt: row.updated_at });
  }

  if (url.pathname === '/api/data' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => null)) as { snapshot?: unknown; baseUpdatedAt?: string | null } | null;
    if (!body || typeof body.snapshot !== 'object' || body.snapshot === null) {
      return json({ error: 'missing snapshot' }, 400);
    }

    // Защита от "последний синхронизировавшийся побеждает вслепую": если
    // клиент знает, с какой версии он стартовал (baseUpdatedAt — из своего
    // последнего pull/push), а на сервере лежит более СВЕЖАЯ версия — значит,
    // пока этот клиент работал, кто-то другой (вторая вкладка/устройство)
    // уже сохранился. Отклоняем перезапись и отдаём актуальный снимок, чтобы
    // клиент подтянул его, а не затёр тихо. Если baseUpdatedAt не передан —
    // старое поведение (например, самый первый push сразу после регистрации,
    // когда ещё нечего было pull'ить).
    if (body.baseUpdatedAt) {
      const existingRows = (await sql`SELECT snapshot, updated_at FROM user_data WHERE user_id = ${userId}`) as Array<{
        snapshot: string;
        updated_at: string;
      }>;
      const existing = existingRows[0] ?? null;
      if (existing && existing.updated_at !== body.baseUpdatedAt) {
        return json({ error: 'conflict', snapshot: JSON.parse(existing.snapshot), updatedAt: existing.updated_at }, 409);
      }
    }

    const now = new Date().toISOString();
    const snapshotJson = JSON.stringify(body.snapshot);
    await sql`
      INSERT INTO user_data (user_id, snapshot, updated_at) VALUES (${userId}, ${snapshotJson}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at
    `;
    return json({ ok: true, updatedAt: now });
  }

  // Список зарегистрированных клиентов — только для владельца приложения.
  // Не привязан к обычному входу/сессии: отдельный секретный ключ (заголовок
  // X-Admin-Key), хранится как секрет воркера, к паролям пользователей
  // отношения не имеет.
  if (url.pathname === '/api/admin/users' && request.method === 'GET') {
    const key = request.headers.get('X-Admin-Key') ?? '';
    if (!env.ADMIN_KEY || !constantTimeEqual(key, env.ADMIN_KEY)) {
      return json({ error: 'unauthorized' }, 401);
    }
    const results = await sql`SELECT username, name, email, created_at FROM users ORDER BY created_at DESC`;
    return json({ users: results ?? [] });
  }

  // Финансовый снимок конкретного клиента (то же самое, что синхронизируется
  // с его устройств через /api/data) — тот же секретный ключ, что и у списка
  // клиентов выше.
  if (url.pathname.startsWith('/api/admin/users/') && url.pathname.endsWith('/data') && request.method === 'GET') {
    const key = request.headers.get('X-Admin-Key') ?? '';
    if (!env.ADMIN_KEY || !constantTimeEqual(key, env.ADMIN_KEY)) {
      return json({ error: 'unauthorized' }, 401);
    }
    const username = decodeURIComponent(url.pathname.split('/')[4] ?? '');
    const userRows = (await sql`SELECT id FROM users WHERE username = ${username}`) as Array<{ id: string }>;
    const user = userRows[0] ?? null;
    if (!user) return json({ error: 'not found' }, 404);
    const rows = (await sql`SELECT snapshot, updated_at FROM user_data WHERE user_id = ${user.id}`) as Array<{
      snapshot: string;
      updated_at: string;
    }>;
    const row = rows[0] ?? null;
    if (!row) return json({ snapshot: null, updatedAt: null });
    return json({ snapshot: JSON.parse(row.snapshot), updatedAt: row.updated_at });
  }

  return null;
}
