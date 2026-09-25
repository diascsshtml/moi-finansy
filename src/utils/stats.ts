import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { kk, ru } from 'date-fns/locale';
import type { TFunction } from 'i18next';
import type { Category, Debt, Transaction, Transfer } from '../types';
import { categoryDisplayName } from './displayName';
import i18n from '../i18n';

function dateFnsLocale() {
  return i18n.language === 'kk' ? kk : ru;
}

export function getCashBalance(transactions: Transaction[]): number {
  let total = 0;
  for (const t of transactions) {
    total += t.type === 'income' ? t.amount : -t.amount;
  }
  return total;
}

/** Баланс отдельно по каждому счёту (Личное/Бизнес/…). Переводы между
 *  своими счетами двигают деньги между счетами, но не меняют общий итог —
 *  сумма всех значений в результате равна getCashBalance(transactions). */
export function getAccountBalances(transactions: Transaction[], transfers: Transfer[]): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (accountId: string, delta: number) => balances.set(accountId, (balances.get(accountId) ?? 0) + delta);
  for (const t of transactions) {
    add(t.accountId, t.type === 'income' ? t.amount : -t.amount);
  }
  for (const tr of transfers) {
    add(tr.fromAccountId, -tr.amount);
    add(tr.toAccountId, tr.amount);
  }
  return balances;
}

export function getDebtTotals(debts: Debt[]): { owedToMe: number; iOwe: number } {
  let owedToMe = 0;
  let iOwe = 0;
  for (const d of debts) {
    if (d.status !== 'open') continue;
    if (d.direction === 'owed_to_me') owedToMe += d.currentAmount;
    else iOwe += d.currentAmount;
  }
  return { owedToMe, iOwe };
}

export interface CategoryBreakdownRow {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
}

/** Разбивка операций по категориям за период; долговые операции исключены,
 *  чтобы не искажать картину "на что реально трачу". */
export function getCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: 'income' | 'expense',
  t: TFunction,
): CategoryBreakdownRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const cat = byId.get(tx.categoryId);
    if (cat?.isDebtRelated) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
  }
  const rows: CategoryBreakdownRow[] = [];
  for (const [categoryId, amount] of totals) {
    const cat = byId.get(categoryId);
    rows.push({
      categoryId,
      name: cat ? categoryDisplayName(cat, t) : t('historyText.noCategory'),
      icon: cat?.icon ?? '❓',
      color: cat?.color ?? '#898781',
      amount,
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

export interface MonthPoint {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
}

/** Ряд доходов/расходов за последние `count` месяцев, включая текущий. */
export function getMonthlySeries(transactions: Transaction[], count = 6): MonthPoint[] {
  const now = new Date();
  const months: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const monthDate = startOfMonth(addMonths(now, -i));
    months.push({
      monthKey: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'LLL', { locale: dateFnsLocale() }),
      income: 0,
      expense: 0,
    });
  }
  const index = new Map(months.map((m) => [m.monthKey, m]));
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    const point = index.get(key);
    if (!point) continue;
    if (t.type === 'income') point.income += t.amount;
    else point.expense += t.amount;
  }
  return months;
}

export function isWithinCurrentMonth(iso: string): boolean {
  const d = parseISO(iso);
  const now = new Date();
  return d >= startOfMonth(now) && d <= endOfMonth(now);
}
