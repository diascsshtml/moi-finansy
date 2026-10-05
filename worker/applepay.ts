// Приём платежей из сторонней автоматизации (Shortcuts-команда на триггере
// «Transaction»/«Wallet» при оплате с карты из Apple Wallet) — см. схему в
// schema.sql (apple_pay_token_hash, pending_transactions) и README-блок в
// settings.applePay.* (i18n) с шагами настройки самой команды.
//
// Поток: пользователь один раз генерирует токен в приложении → вставляет
// его в команду Shortcuts (шаг «Get Contents of URL», POST на /api/webhook/
// apple-pay с суммой/продавцом) → при каждой оплате Shortcuts шлёт платёж
// сюда в фоне, даже если наше приложение не открыто → он оседает в
// pending_transactions → при следующем запуске приложение заберёт его
// (GET .../pending), создаст обычную операцию локально, отправит обновлённый
// снимок и подтвердит получение (POST .../ack) — см. src/utils/applePay.ts.

import { neon } from '@neondatabase/serverless';
import { generateToken, readSessionCookie, sha256Hex, verifySessionToken } from './auth';

export interface ApplePayEnv {
  DATABASE_URL: string;
  SESSION_SECRET: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function currentUserId(request: Request, env: ApplePayEnv): Promise<string | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  return verifySessionToken(token, env.SESSION_SECRET);
}

function isValidAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount < 100_000_000;
}

export async function handleApplePayApi(request: Request, env: ApplePayEnv, url: URL): Promise<Response | null> {
  const sql = neon(env.DATABASE_URL);

  // Включить/перевыпустить токен — старый (если был) сразу перестаёт
  // работать, т.к. хэш в базе просто перезаписывается. Сам токен виден
  // пользователю только в этом ответе, дальше хранится только его хэш.
  if (url.pathname === '/api/auth/apple-pay-token' && request.method === 'POST') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const token = generateToken();
    const hash = await sha256Hex(token);
    await sql`UPDATE users SET apple_pay_token_hash = ${hash} WHERE id = ${userId}`;
    return json({ token });
  }

  if (url.pathname === '/api/auth/apple-pay-token' && request.method === 'DELETE') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    await sql`UPDATE users SET apple_pay_token_hash = NULL WHERE id = ${userId}`;
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/apple-pay-token' && request.method === 'GET') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const rows = (await sql`SELECT apple_pay_token_hash FROM users WHERE id = ${userId}`) as Array<{ apple_pay_token_hash: string | null }>;
    return json({ enabled: !!rows[0]?.apple_pay_token_hash });
  }

  // Вебхук — вызывается самой Shortcuts-командой, без сессии/куки (их там
  // нет), поэтому аутентификация через токен пользователя. Токен принимаем
  // и из тела запроса (приоритетно — заголовки в Shortcuts на реальных,
  // автоматических запусках оказались ненадёжными, см. историю отладки), и
  // из заголовка X-Apple-Pay-Token для обратной совместимости. Платёж всегда
  // расход (оплата картой) — направление менять не даём, это не форма для
  // ручного ввода.
  if (url.pathname === '/api/webhook/apple-pay' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { amount?: unknown; merchant?: unknown; date?: unknown; token?: unknown };
    const rawToken = typeof body.token === 'string' && body.token ? body.token : (request.headers.get('X-Apple-Pay-Token') ?? '');
    // Нормализуем регистр и пробелы — токен всегда генерируется строчными
    // hex-символами, но при копировании/вставке на телефоне автозамена
    // иногда делает заглавной первую букву или цепляет пробел по краям; сам
    // токен достаточно случайный, так что это не ослабляет защиту.
    const token = rawToken.trim().toLowerCase();
    if (!token) return json({ error: 'missing token' }, 401);
    const hash = await sha256Hex(token);
    const rows = (await sql`SELECT id FROM users WHERE apple_pay_token_hash = ${hash}`) as Array<{ id: string }>;
    const user = rows[0] ?? null;
    if (!user) return json({ error: 'invalid token' }, 401);

    if (!isValidAmount(body.amount)) {
      return json({ error: 'invalid amount' }, 400);
    }
    const merchant = typeof body.merchant === 'string' ? body.merchant.slice(0, 200) : null;
    const occurredAt = typeof body.date === 'string' && body.date ? body.date : new Date().toISOString();

    await sql`
      INSERT INTO pending_transactions (id, user_id, amount, merchant, occurred_at, created_at)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${body.amount}, ${merchant}, ${occurredAt}, ${new Date().toISOString()})
    `;
    return json({ ok: true });
  }

  if (url.pathname === '/api/transactions/pending' && request.method === 'GET') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const rows = await sql`
      SELECT id, amount, merchant, occurred_at FROM pending_transactions WHERE user_id = ${userId} ORDER BY occurred_at ASC
    `;
    return json({ items: rows ?? [] });
  }

  if (url.pathname === '/api/transactions/pending/ack' && request.method === 'POST') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
    if (ids.length === 0) return json({ ok: true });
    await sql`DELETE FROM pending_transactions WHERE user_id = ${userId} AND id = ANY(${ids}::text[])`;
    return json({ ok: true });
  }

  return null;
}
