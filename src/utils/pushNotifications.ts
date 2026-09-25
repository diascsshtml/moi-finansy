// Часовые напоминания через настоящий Web Push (нужен воркер-бэкенд — см.
// worker/index.ts). В отличие от notifications.ts (уведомления о платежах,
// показываются только пока приложение открыто), это работает и когда
// приложение полностью закрыто: сервер сам будит его раз в час.
// Никакие финансовые данные при этом никуда не уходят — на сервере хранится
// только подписка (endpoint + ключи шифрования от браузера), присланная
// самим браузером при подписке.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isHourlyReminderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export async function isSubscribedToHourlyReminders(): Promise<boolean> {
  if (!isHourlyReminderSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

async function postJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`request-failed:${path}:${res.status}`);
}

/** Запрашивает разрешение на уведомления (если ещё не решено), подписывает
 *  устройство на push и сообщает подписку серверу. Бросает исключение при
 *  отказе/неподдержке — вызывающий код должен показать соответствующее сообщение. */
export async function subscribeToHourlyReminders(): Promise<void> {
  if (!isHourlyReminderSupported() || !VAPID_PUBLIC_KEY) {
    throw new Error('push-unsupported');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('permission-denied');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  await postJson('/api/push/subscribe', { subscription: subscription.toJSON() });
}

/** Шлёт одно тестовое напоминание прямо сейчас — чтобы проверить, что всё
 *  настроено верно, не дожидаясь ближайшего часа. Сообщение исключения —
 *  реальная причина (от сервера или браузера), чтобы её можно было показать
 *  пользователю напрямую при диагностике. */
export async function sendTestReminder(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Нет активной подписки в этом браузере — сначала включите напоминания заново');

  let res: Response;
  try {
    res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (e) {
    throw new Error(`Сеть: не удалось достучаться до сервера (${e instanceof Error ? e.message : String(e)})`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Сервер вернул ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}

export async function unsubscribeFromHourlyReminders(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await postJson('/api/push/unsubscribe', { endpoint });
}
