import { addMonths, differenceInCalendarDays, format, getDaysInMonth, isSameMonth, parseISO, setDate, startOfMonth } from 'date-fns';
import type { TFunction } from 'i18next';
import type { RecurringBill, Transaction } from '../types';

export type BillStatusKind = 'paid' | 'overdue' | 'due_soon' | 'upcoming' | 'paused';

export interface BillStatus {
  bill: RecurringBill;
  status: BillStatusKind;
  dueDate: Date;
  daysUntilDue: number;
  lastPaymentDate?: string;
}

/** День оплаты в конкретном месяце — с учётом того, что не в каждом месяце
 *  есть, например, 31-е число (тогда берём последний день месяца). */
export function getDueDateInMonth(dayOfMonth: number, referenceDate: Date): Date {
  const daysInMonth = getDaysInMonth(referenceDate);
  const clampedDay = Math.min(dayOfMonth, daysInMonth);
  return setDate(startOfMonth(referenceDate), clampedDay);
}

export function getBillStatus(bill: RecurringBill, transactions: Transaction[], today: Date = new Date()): BillStatus {
  let dueDate = getDueDateInMonth(bill.dayOfMonth, today);
  if (bill.firstDueDate) {
    // Первый цикл — ровно та дата, что выбрали в форме при создании платежа
    // (могла быть в любом будущем месяце). Пока расчёт по сегодняшней дате
    // не «дорос» до её месяца — показываем именно её, а не произвольный
    // промежуточный месяц.
    const firstDue = parseISO(bill.firstDueDate);
    if (dueDate < startOfMonth(firstDue)) {
      dueDate = firstDue;
    }
  } else if (dueDate < parseISO(bill.createdAt)) {
    // Платежи, созданные до появления firstDueDate — прежняя логика: если
    // день оплаты в этом месяце уже прошёл к моменту создания, первый цикл
    // сдвигается на один месяц вперёд (платёж не мог быть оплачен через
    // приложение до своего создания, поэтому это не «просрочка»).
    dueDate = getDueDateInMonth(bill.dayOfMonth, addMonths(today, 1));
  }
  const payments = transactions
    .filter((t) => t.billId === bill.id && isSameMonth(parseISO(t.date), dueDate))
    .sort((a, b) => b.date.localeCompare(a.date));
  const paidThisCycle = payments.length > 0;
  const daysUntilDue = differenceInCalendarDays(dueDate, today);

  let status: BillStatusKind;
  if (!bill.isActive) status = 'paused';
  else if (paidThisCycle) status = 'paid';
  else if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue <= bill.reminderDaysBefore) status = 'due_soon';
  else status = 'upcoming';

  return { bill, status, dueDate, daysUntilDue, lastPaymentDate: payments[0]?.date };
}

const STATUS_ORDER: Record<BillStatusKind, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  paid: 3,
  paused: 4,
};

export function getAllBillStatuses(
  bills: RecurringBill[],
  transactions: Transaction[],
  today: Date = new Date(),
): BillStatus[] {
  return bills
    .map((b) => getBillStatus(b, transactions, today))
    .sort((a, b) => {
      const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (orderDiff !== 0) return orderDiff;
      return a.daysUntilDue - b.daysUntilDue;
    });
}

/** Текст вида «через 3 дн.» / «сегодня» / «просрочен на 3 дн.» — используется
 *  и в списке платежей, и на странице платежа, чтобы формулировка совпадала. */
export function getDueRelativeLabel(status: BillStatus, t: TFunction): string {
  if (status.status === 'overdue') return t('bills.overdueDaysBadge', { days: Math.abs(status.daysUntilDue) });
  if (status.daysUntilDue === 0) return t('bills.dueTodayBadge');
  return t('bills.dueInDaysBadge', { days: status.daysUntilDue });
}

export interface BillMonthGroup {
  monthKey: string; // 'yyyy-MM'
  monthDate: Date;
  statuses: BillStatus[];
}

/** Тот же список платежей, но разбитый по месяцу следующей оплаты —
 *  чтобы в общем списке не путались платежи из «в этом месяце» и «в
 *  следующем». Внутри месяца — по дню оплаты, месяцы идут по порядку. */
export function getBillsGroupedByMonth(
  bills: RecurringBill[],
  transactions: Transaction[],
  today: Date = new Date(),
): BillMonthGroup[] {
  const statuses = bills
    .map((b) => getBillStatus(b, transactions, today))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const groups = new Map<string, BillMonthGroup>();
  for (const s of statuses) {
    const monthKey = format(s.dueDate, 'yyyy-MM');
    let group = groups.get(monthKey);
    if (!group) {
      group = { monthKey, monthDate: startOfMonth(s.dueDate), statuses: [] };
      groups.set(monthKey, group);
    }
    group.statuses.push(s);
  }
  return Array.from(groups.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/** Платежи, которые нуждаются во внимании прямо сейчас — просроченные и
 *  те, что скоро наступают (и ещё не оплачены). Используется для баннера
 *  на главном экране, бейджа на вкладке и уведомлений. */
export function getBillsNeedingAttention(bills: RecurringBill[], transactions: Transaction[], today: Date = new Date()) {
  return getAllBillStatuses(bills, transactions, today).filter(
    (s) => s.status === 'overdue' || s.status === 'due_soon',
  );
}
