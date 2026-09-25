import type { TFunction } from 'i18next';
import type { Account, Category, Debt, DebtPayment, HistoryEntry, Person, Transaction, Transfer } from '../types';
import { NEUTRAL_COLOR } from '../styles/palette';
import { categoryDisplayName, accountDisplayName } from './displayName';

/** Собирает единую ленту "все операции" из транзакций, долговых событий,
 *  которые НЕ породили транзакцию (linkedToBalance=false), списаний долгов
 *  и переводов между счетами — чтобы каждое действие пользователя было
 *  видно в истории ровно один раз. */
export function buildHistory(
  transactions: Transaction[],
  debts: Debt[],
  debtPayments: DebtPayment[],
  people: Person[],
  categories: Category[],
  transfers: Transfer[] = [],
  accounts: Account[] = [],
  t?: TFunction,
): HistoryEntry[] {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const debtsById = new Map(debts.map((d) => [d.id, d]));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const entries: HistoryEntry[] = [];
  const tr: TFunction = t ?? (((key: string) => key) as TFunction);

  for (const tx of transactions) {
    const cat = categoriesById.get(tx.categoryId);
    const subtitle = tx.counterparty && tx.note ? `${tx.counterparty} — ${tx.note}` : tx.counterparty || tx.note;
    entries.push({
      id: `tx-${tx.id}`,
      kind: tx.type,
      date: tx.date,
      createdAt: tx.createdAt,
      amount: tx.amount,
      title: cat ? categoryDisplayName(cat, tr) : tr('historyText.noCategory'),
      subtitle,
      icon: cat?.icon ?? '❓',
      color: cat?.color ?? NEUTRAL_COLOR.light,
      accountId: tx.accountId,
      transaction: tx,
    });
  }

  for (const d of debts) {
    const person = peopleById.get(d.personId);
    const name = person?.name ?? '';
    if (!d.linkedToBalance) {
      entries.push({
        id: `debt-${d.id}`,
        kind: 'debt_created',
        date: d.date,
        createdAt: d.createdAt,
        amount: d.initialAmount,
        title: tr(d.direction === 'i_owe' ? 'historyText.debtCreatedIOwe' : 'historyText.debtCreatedOwedToMe', { name }),
        subtitle: d.note,
        icon: '🤝',
        color: NEUTRAL_COLOR.light,
        accountId: d.accountId,
        debt: d,
        person,
      });
    }
    if (d.writtenOff) {
      entries.push({
        id: `debt-wo-${d.id}`,
        kind: 'debt_written_off',
        date: d.closedAt?.slice(0, 10) ?? d.date,
        createdAt: d.closedAt ?? d.createdAt,
        amount: d.writtenOffAmount ?? 0,
        title: tr('historyText.debtWrittenOff', { name }),
        subtitle: d.note,
        icon: '🗑️',
        color: NEUTRAL_COLOR.light,
        accountId: d.accountId,
        debt: d,
        person,
      });
    }
  }

  for (const p of debtPayments) {
    const debt = debtsById.get(p.debtId);
    if (debt && !debt.linkedToBalance) {
      const person = peopleById.get(debt.personId);
      const name = person?.name ?? '';
      entries.push({
        id: `pay-${p.id}`,
        kind: 'debt_payment',
        date: p.date,
        createdAt: p.createdAt,
        amount: p.amount,
        title: tr(debt.direction === 'i_owe' ? 'historyText.debtPaymentIOwe' : 'historyText.debtPaymentOwedToMe', { name }),
        subtitle: p.note,
        icon: '💳',
        color: NEUTRAL_COLOR.light,
        accountId: debt.accountId,
        debtPayment: p,
        debt,
        person,
      });
    }
  }

  for (const t2 of transfers) {
    const from = accountsById.get(t2.fromAccountId);
    const to = accountsById.get(t2.toAccountId);
    entries.push({
      id: `transfer-${t2.id}`,
      kind: 'transfer',
      date: t2.date,
      createdAt: t2.createdAt,
      amount: t2.amount,
      title: `${from ? accountDisplayName(from, tr) : '—'} → ${to ? accountDisplayName(to, tr) : '—'}`,
      subtitle: t2.note,
      icon: '🔄',
      color: NEUTRAL_COLOR.light,
      accountId: t2.fromAccountId,
      transfer: t2,
    });
  }

  entries.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  return entries;
}
