import { neon } from '@neondatabase/serverless';
import { sendWebPush, type PushSubscriptionInfo, type VapidKeys } from './webpush';

export interface NotificationsEnv {
  DATABASE_URL: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT: string;
}

interface BillLike {
  id: string;
  dayOfMonth: number;
  firstDueDate?: string;
  isActive: boolean;
  createdAt: string;
}

interface TransactionLike {
  billId?: string;
  date: string;
}

interface PrefsRow {
  user_id: string;
  timezone: string;
  daily_enabled: boolean;
  daily_time: string;
  bills_enabled: boolean;
  bills_days_before: string;
  bills_time: string;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface SnapshotRow {
  snapshot: string;
}

/** yyyy-MM-dd в указанном IANA часовом поясе — намеренно без date-fns (воркер
 *  держим без лишних зависимостей, как и webpush.ts/auth.ts): 'en-CA' сразу
 *  форматирует в нужном порядке. */
function localDateISO(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function localHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')!.value);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueDateInMonthISO(dayOfMonth: number, year: number, month: number): string {
  const clamped = Math.min(dayOfMonth, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(...(fromISO.split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(toISO.split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86400000);
}

/** Упрощённая (но по сути идентичная src/utils/bills.ts getBillStatus) серверная
 *  версия расчёта дня оплаты — календарные yyyy-MM-dd строки вместо Date,
 *  так надёжнее без часовых поясов на этапе самой арифметики. */
function getDueDateISO(bill: BillLike, todayISO: string): string {
  const [ty, tm] = todayISO.split('-').map(Number);
  let due = dueDateInMonthISO(bill.dayOfMonth, ty, tm);
  if (bill.firstDueDate) {
    if (due.slice(0, 7) < bill.firstDueDate.slice(0, 7)) due = bill.firstDueDate;
  } else if (due < bill.createdAt.slice(0, 10)) {
    const nextMonth = tm === 12 ? 1 : tm + 1;
    const nextYear = tm === 12 ? ty + 1 : ty;
    due = dueDateInMonthISO(bill.dayOfMonth, nextYear, nextMonth);
  }
  return due;
}

/** Есть ли среди активных, ещё не оплаченных в этом цикле платежей такой,
 *  что до его срока осталось ровно N дней, где N — одно из выбранных
 *  пользователем значений (см. bills_days_before). */
function hasMatchingBillDue(bills: BillLike[], transactions: TransactionLike[], todayISO: string, daysBefore: number[]): boolean {
  for (const bill of bills) {
    if (!bill.isActive) continue;
    const dueISO = getDueDateISO(bill, todayISO);
    const paidThisCycle = transactions.some((t) => t.billId === bill.id && t.date.slice(0, 7) === dueISO.slice(0, 7));
    if (paidThisCycle) continue;
    const daysUntilDue = daysBetween(todayISO, dueISO);
    if (daysBefore.includes(daysUntilDue)) return true;
  }
  return false;
}

async function sendToAll(subs: SubRow[], payload: unknown, vapid: VapidKeys, contact: string, onGone: (endpoint: string) => Promise<void>) {
  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscriptionInfo = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        const res = await sendWebPush(subscription, payload, vapid, contact);
        if (res.status === 404 || res.status === 410) await onGone(s.endpoint);
      } catch {
        // сетевая ошибка до push-сервиса — пробуем в следующий час, подписку не трогаем
      }
    }),
  );
}

/** Раз в час (см. triggers.crons в wrangler.jsonc и scheduled() в index.ts)
 *  проходит по всем пользователям с включённым хотя бы одним напоминанием и
 *  для каждого проверяет, не настал ли у него локально час, указанный в
 *  daily_time/bills_time — часовой пояс каждого пользователя свой (см.
 *  notification_prefs.timezone, отправляется браузером при подписке). */
export async function runNotificationSweep(env: NotificationsEnv): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  const vapid: VapidKeys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const now = new Date();

  const prefsRows = (await sql`
    SELECT user_id, timezone, daily_enabled, daily_time, bills_enabled, bills_days_before, bills_time
    FROM notification_prefs
    WHERE daily_enabled = true OR bills_enabled = true
  `) as PrefsRow[];

  for (const prefs of prefsRows) {
    const subs = (await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${prefs.user_id}`) as SubRow[];
    if (subs.length === 0) continue;

    const hour = localHour(now, prefs.timezone);
    const todayISO = localDateISO(now, prefs.timezone);
    const deleteGone = async (endpoint: string): Promise<void> => {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    };

    if (prefs.daily_enabled && hour === Number(prefs.daily_time.split(':')[0])) {
      await sendToAll(subs, { title: 'Мои финансы', body: 'Не забудьте внести операции за сегодня.', tag: 'daily-reminder' }, vapid, env.VAPID_CONTACT, deleteGone);
    }

    if (prefs.bills_enabled && hour === Number(prefs.bills_time.split(':')[0])) {
      let daysBefore: number[] = [];
      try {
        daysBefore = JSON.parse(prefs.bills_days_before);
      } catch {
        daysBefore = [];
      }
      if (daysBefore.length > 0) {
        const dataRows = (await sql`SELECT snapshot FROM user_data WHERE user_id = ${prefs.user_id}`) as SnapshotRow[];
        const snapshot = dataRows[0] ? JSON.parse(dataRows[0].snapshot) : null;
        const bills: BillLike[] = snapshot?.bills ?? [];
        const transactions: TransactionLike[] = snapshot?.transactions ?? [];
        if (hasMatchingBillDue(bills, transactions, todayISO, daysBefore)) {
          await sendToAll(
            subs,
            { title: 'Мои финансы', body: 'Проверьте платежи, которые скоро наступают.', tag: 'bills-reminder' },
            vapid,
            env.VAPID_CONTACT,
            deleteGone,
          );
        }
      }
    }
  }
}
