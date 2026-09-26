import { neon } from '@neondatabase/serverless';
import { sendWebPush, type PushSubscriptionInfo } from './webpush';
import { handleAccountsApi } from './accounts-api';
import { readSessionCookie, verifySessionToken } from './auth';
import { runNotificationSweep } from './notifications';

export interface Env {
  ASSETS: Fetcher;
  DATABASE_URL: string;
  SESSION_SECRET: string;
  ADMIN_KEY: string;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function currentUserId(request: Request, env: Env): Promise<string | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  return verifySessionToken(token, env.SESSION_SECRET);
}

interface PrefsRow {
  timezone: string;
  daily_enabled: boolean;
  daily_time: string;
  bills_enabled: boolean;
  bills_days_before: string;
  bills_time: string;
}

function prefsToJson(row: PrefsRow | null) {
  if (!row) {
    return { timezone: 'Asia/Almaty', dailyEnabled: false, dailyTime: '20:00', billsEnabled: false, billsDaysBefore: [1], billsTime: '10:00' };
  }
  let billsDaysBefore: number[] = [1];
  try {
    billsDaysBefore = JSON.parse(row.bills_days_before);
  } catch {
    billsDaysBefore = [1];
  }
  return {
    timezone: row.timezone,
    dailyEnabled: row.daily_enabled,
    dailyTime: row.daily_time,
    billsEnabled: row.bills_enabled,
    billsDaysBefore,
    billsTime: row.bills_time,
  };
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const accountsResponse = await handleAccountsApi(request, env, url);
  if (accountsResponse) return accountsResponse;

  if (url.pathname.startsWith('/api/push/')) {
    try {
      return await handlePushApi(request, env, url);
    } catch (e) {
      // Любая необработанная ошибка здесь (например, отсутствующая таблица
      // после незавершённой миграции схемы) иначе улетела бы дальше как
      // непрозрачная страница ошибки воркера — так видно настоящую причину.
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  return json({ error: 'not found' }, 404);
}

async function handlePushApi(request: Request, env: Env, url: URL): Promise<Response> {
  const sql = neon(env.DATABASE_URL);

  // Подписывает текущее устройство на push и сохраняет часовой пояс браузера —
  // без него сервер не может понять, что для пользователя сейчас настал именно
  // его daily_time/bills_time (см. worker/notifications.ts). Требует входа —
  // подписка всегда привязана к аккаунту, не анонимна.
  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { subscription?: PushSubscriptionInfo; timezone?: string };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return json({ error: 'invalid subscription' }, 400);
    }
    const now = new Date().toISOString();
    await sql`
      INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
      VALUES (${sub.endpoint}, ${userId}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${now})
      ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
    `;
    if (body.timezone) {
      await sql`
        INSERT INTO notification_prefs (user_id, timezone, updated_at) VALUES (${userId}, ${body.timezone}, ${now})
        ON CONFLICT (user_id) DO UPDATE SET timezone = excluded.timezone, updated_at = excluded.updated_at
      `;
    }
    return json({ ok: true });
  }

  if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (!body.endpoint) return json({ error: 'missing endpoint' }, 400);
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${body.endpoint} AND user_id = ${userId}`;
    return json({ ok: true });
  }

  // Шлёт напоминание немедленно на все подписки текущего пользователя — чтобы
  // можно было проверить, что уведомления реально доходят, не дожидаясь часа.
  if (url.pathname === '/api/push/test' && request.method === 'POST') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const subs = (await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}`) as Array<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
    if (subs.length === 0) return json({ error: 'not subscribed' }, 404);
    const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    const payload = { title: 'Мои финансы', body: 'Тестовое уведомление — всё работает.', tag: 'test-reminder' };
    try {
      const results = await Promise.all(
        subs.map((s) =>
          sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, env.VAPID_CONTACT),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) return json({ error: `push service returned ${failed.status}` }, 502);
      return json({ ok: true });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  if (url.pathname === '/api/push/prefs' && request.method === 'GET') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const rows = (await sql`
      SELECT timezone, daily_enabled, daily_time, bills_enabled, bills_days_before, bills_time
      FROM notification_prefs WHERE user_id = ${userId}
    `) as PrefsRow[];
    return json(prefsToJson(rows[0] ?? null));
  }

  if (url.pathname === '/api/push/prefs' && request.method === 'PUT') {
    const userId = await currentUserId(request, env);
    if (!userId) return json({ error: 'not authenticated' }, 401);
    const body = (await request.json().catch(() => ({}))) as {
      dailyEnabled?: boolean;
      dailyTime?: string;
      billsEnabled?: boolean;
      billsDaysBefore?: number[];
      billsTime?: string;
      timezone?: string;
    };
    const now = new Date().toISOString();
    const dailyEnabled = !!body.dailyEnabled;
    const dailyTime = body.dailyTime ?? '20:00';
    const billsEnabled = !!body.billsEnabled;
    const billsDaysBefore = JSON.stringify(Array.isArray(body.billsDaysBefore) ? body.billsDaysBefore : [1]);
    const billsTime = body.billsTime ?? '10:00';
    const timezone = body.timezone ?? 'Asia/Almaty';
    await sql`
      INSERT INTO notification_prefs (user_id, timezone, daily_enabled, daily_time, bills_enabled, bills_days_before, bills_time, updated_at)
      VALUES (${userId}, ${timezone}, ${dailyEnabled}, ${dailyTime}, ${billsEnabled}, ${billsDaysBefore}, ${billsTime}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET
        timezone = excluded.timezone,
        daily_enabled = excluded.daily_enabled,
        daily_time = excluded.daily_time,
        bills_enabled = excluded.bills_enabled,
        bills_days_before = excluded.bills_days_before,
        bills_time = excluded.bills_time,
        updated_at = excluded.updated_at
    `;
    return json({ ok: true });
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runNotificationSweep(env));
  },
};
