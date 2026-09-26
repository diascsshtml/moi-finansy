// Настоящие push-уведомления через Web Push (нужен воркер-бэкенд — см.
// worker/index.ts, worker/notifications.ts). В отличие от notifications.ts
// (уведомления о платежах, показываются только пока приложение открыто),
// это работает и когда приложение полностью закрыто: сервер сам будит его
// в настроенное пользователем время (см. NotificationsSettingsPage).
// Никакие финансовые данные при подписке никуда не уходят — на сервере
// хранится только подписка устройства (endpoint + ключи шифрования от
// браузера) и часовой пояс; реальные платежи сервер читает из уже
// синхронизированного снимка (см. dataSync.ts) только в момент проверки.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export interface NotificationPrefs {
  timezone: string;
  dailyEnabled: boolean;
  dailyTime: string;
  billsEnabled: boolean;
  billsDaysBefore: number[];
  billsTime: string;
}

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty';
  } catch {
    return 'Asia/Almaty';
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`request-failed:${path}:${res.status}`);
  return res.json() as Promise<T>;
}

/** Подписывает устройство на push (если ещё не подписано) и сообщает
 *  серверу подписку + часовой пояс. Бросает исключение при отказе/
 *  неподдержке — вызывающий код должен показать соответствующее сообщение. */
export async function ensurePushSubscription(): Promise<void> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
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

  await fetchJson('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON(), timezone: currentTimeZone() }),
  });
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return fetchJson<NotificationPrefs>('/api/push/prefs');
}

/** Сохраняет настройки на сервере. Если включают хотя бы одно напоминание —
 *  сначала гарантирует подписку устройства (иначе серверу некому слать). */
export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  if (prefs.dailyEnabled || prefs.billsEnabled) {
    await ensurePushSubscription();
  }
  await fetchJson('/api/push/prefs', {
    method: 'PUT',
    body: JSON.stringify({ ...prefs, timezone: currentTimeZone() }),
  });
}

/** Шлёт тестовое уведомление прямо сейчас на все подписки текущего
 *  аккаунта — чтобы проверить, что всё настроено верно, не дожидаясь
 *  настроенного времени. Сообщение исключения — реальная причина (от
 *  сервера или браузера), чтобы её можно было показать пользователю. */
export async function sendTestReminder(): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/push/test', { method: 'POST', credentials: 'same-origin' });
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
