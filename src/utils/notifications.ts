// Уведомления о регулярных платежах. Важное ограничение: приложение работает
// без сервера, поэтому настоящие push-уведомления (которые приходят, даже
// когда приложение закрыто) здесь невозможны технически — для них нужен
// сервер, отправляющий push через VAPID/Web Push, а это уже не локальное
// приложение. То, что реализовано ниже — системное уведомление в момент,
// когда пользователь открывает (или разворачивает) приложение, если есть
// платежи, которые скоро наступают или просрочены. Плюс к этому — заметный
// баннер в интерфейсе, который не зависит от разрешений браузера вообще.

import type { TFunction } from 'i18next';
import type { BillStatus } from './bills';
import { formatMoney } from './format';

const DEDUPE_KEY = 'finance-app:notified-bills';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function readDedupeSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DEDUPE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeDedupeSet(set: Set<string>) {
  try {
    // Не даём набору расти бесконечно — оставляем только записи за последние ~120 дней по счёту элементов.
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(DEDUPE_KEY, JSON.stringify(arr));
  } catch {
    // localStorage может быть недоступен (приватный режим и т.п.) — тогда просто не дедуплицируем.
  }
}

/** Показывает системное уведомление по каждому платежу, который просрочен
 *  или скоро наступает — не чаще одного раза в день на платёж, чтобы не
 *  спамить при каждом открытии приложения в один и тот же день. */
export async function notifyAboutBills(statuses: BillStatus[], currency: string, t: TFunction, todayKey: string) {
  if (getNotificationPermission() !== 'granted') return;
  if (statuses.length === 0) return;

  const dedupe = readDedupeSet();
  let registration: ServiceWorkerRegistration | undefined;
  try {
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.ready;
    }
  } catch {
    registration = undefined;
  }

  for (const s of statuses) {
    if (s.bill.notifyEnabled === false) continue;
    const dedupeKey = `${s.bill.id}:${todayKey}`;
    if (dedupe.has(dedupeKey)) continue;

    const title = s.status === 'overdue' ? t('bills.notifyOverdueTitle') : t('bills.notifyDueSoonTitle');
    const body =
      s.status === 'overdue'
        ? t('bills.notifyOverdueBody', { name: s.bill.name, amount: formatMoney(s.bill.amount, currency) })
        : t('bills.notifyDueSoonBody', {
            name: s.bill.name,
            amount: formatMoney(s.bill.amount, currency),
            days: s.daysUntilDue,
          });

    try {
      if (registration) {
        await registration.showNotification(title, { body, icon: '/pwa-192.png', tag: `bill-${s.bill.id}` });
      } else {
        new Notification(title, { body, icon: '/pwa-192.png', tag: `bill-${s.bill.id}` });
      }
      dedupe.add(dedupeKey);
    } catch {
      // Часть браузеров (особенно на мобильных без установленного PWA) может
      // отклонить показ уведомления — тогда просто полагаемся на баннер в интерфейсе.
    }
  }

  writeDedupeSet(dedupe);
}
