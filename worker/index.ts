import { sendWebPush, type PushSubscriptionInfo } from './webpush';
import { handleAccountsApi } from './accounts-api';

export interface Env {
  ASSETS: Fetcher;
  PUSH_SUBS: KVNamespace;
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

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const accountsResponse = await handleAccountsApi(request, env, url);
  if (accountsResponse) return accountsResponse;

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    const body = (await request.json()) as { subscription?: PushSubscriptionInfo };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return json({ error: 'invalid subscription' }, 400);
    }
    await env.PUSH_SUBS.put(sub.endpoint, JSON.stringify(sub));
    return json({ ok: true });
  }

  if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) return json({ error: 'missing endpoint' }, 400);
    await env.PUSH_SUBS.delete(body.endpoint);
    return json({ ok: true });
  }

  // Шлёт напоминание немедленно, только на переданную подписку — чтобы можно
  // было проверить, что уведомления реально доходят, не дожидаясь целого часа.
  if (url.pathname === '/api/push/test' && request.method === 'POST') {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) return json({ error: 'missing endpoint' }, 400);
    const raw = await env.PUSH_SUBS.get(body.endpoint);
    if (!raw) return json({ error: 'not subscribed' }, 404);
    const subscription = JSON.parse(raw) as PushSubscriptionInfo;
    try {
      const res = await sendReminder(subscription, env);
      if (!res.ok) return json({ error: `push service returned ${res.status}` }, 502);
      return json({ ok: true });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  return json({ error: 'not found' }, 404);
}

function reminderPayload() {
  return {
    title: 'Мои финансы',
    body: 'Загляните в приложение — проверьте операции и платежи за этот час.',
    tag: 'hourly-reminder',
  };
}

function sendReminder(subscription: PushSubscriptionInfo, env: Env): Promise<Response> {
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  return sendWebPush(subscription, reminderPayload(), vapid, env.VAPID_CONTACT);
}

/** Раз в час (см. triggers.crons в wrangler.jsonc) шлёт короткое напоминание
 *  всем подписанным устройствам. Само приложение — и все финансовые данные —
 *  остаются только в браузере пользователя; сюда попадает лишь подписка на
 *  push (endpoint + ключи шифрования от самого браузера), текст напоминания
 *  общий и никак не завязан на реальные операции/долги. */
async function sendHourlyReminders(env: Env): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.PUSH_SUBS.list({ cursor });
    await Promise.all(
      page.keys.map(async (key) => {
        const raw = await env.PUSH_SUBS.get(key.name);
        if (!raw) return;
        const subscription = JSON.parse(raw) as PushSubscriptionInfo;
        try {
          const res = await sendReminder(subscription, env);
          if (res.status === 404 || res.status === 410) {
            // Подписка больше не действительна (юзер выключил уведомления,
            // переустановил приложение и т.п.) — убираем, чтобы не копилось.
            await env.PUSH_SUBS.delete(key.name);
          }
        } catch {
          // Сетевая ошибка до push-сервиса — пробуем в следующий раз, не удаляем подписку.
        }
      }),
    );
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
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
    ctx.waitUntil(sendHourlyReminders(env));
  },
};
