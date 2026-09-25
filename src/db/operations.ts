import { db } from './db';
import { SETTINGS_ID, SYSTEM_CATEGORY_IDS } from './constants';
import { makeId } from '../utils/id';
import { nowISO, todayISO } from '../utils/format';
import { generateSalt, hashPin, verifyPin } from '../utils/pin';
import i18n from '../i18n';
import type {
  Account,
  Category,
  Debt,
  DebtDirection,
  Person,
  RecurringBill,
  Transaction,
  TransactionType,
  Transfer,
} from '../types';

// ---------- Счета ----------

export async function createAccount(input: { name: string; icon: string; color: string; bank?: string }): Promise<Account> {
  const count = await db.accounts.count();
  const account: Account = {
    id: makeId(),
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    order: count,
    bank: input.bank?.trim() || undefined,
  };
  await db.accounts.add(account);
  return account;
}

/** clearNameKey: true — пользователь реально изменил название встроенного
 *  счёта, поэтому оно перестаёт следовать за языком интерфейса и остаётся
 *  ровно тем текстом, что он ввёл. */
export async function updateAccount(
  id: string,
  patch: Partial<Pick<Account, 'name' | 'icon' | 'color' | 'bank'>>,
  clearNameKey = false,
) {
  await db.accounts.update(id, clearNameKey ? { ...patch, nameKey: undefined } : patch);
}

/** Удаляет счёт, перенося все его операции/долги на другой счёт. Нельзя
 *  удалить последний оставшийся счёт — деньгам всегда нужен хотя бы один "карман". */
export async function deleteAccount(id: string, fallbackAccountId: string) {
  const total = await db.accounts.count();
  if (total <= 1) return;
  const account = await db.accounts.get(id);
  if (!account) return;
  await db.transaction('rw', db.accounts, db.transactions, db.debts, db.transfers, async () => {
    await db.transactions.where({ accountId: id }).modify({ accountId: fallbackAccountId });
    await db.debts.where({ accountId: id }).modify({ accountId: fallbackAccountId });
    await db.transfers.where({ fromAccountId: id }).modify({ fromAccountId: fallbackAccountId });
    await db.transfers.where({ toAccountId: id }).modify({ toAccountId: fallbackAccountId });
    await db.accounts.delete(id);
  });
}

// ---------- Категории ----------

export async function createCategory(input: {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}): Promise<Category> {
  const count = await db.categories.where({ type: input.type }).count();
  const category: Category = {
    id: makeId(),
    name: input.name.trim(),
    type: input.type,
    icon: input.icon,
    color: input.color,
    order: count,
  };
  await db.categories.add(category);
  return category;
}

/** См. updateAccount — та же логика для встроенных категорий по умолчанию. */
export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>,
  clearNameKey = false,
) {
  await db.categories.update(id, clearNameKey ? { ...patch, nameKey: undefined } : patch);
}

export async function deleteCategory(id: string, fallbackCategoryId: string) {
  const cat = await db.categories.get(id);
  if (!cat || cat.isSystem) return;
  await db.transaction('rw', db.transactions, db.categories, async () => {
    await db.transactions.where({ categoryId: id }).modify({ categoryId: fallbackCategoryId });
    await db.categories.delete(id);
  });
}

// ---------- Обычные операции (доход/расход) ----------

export async function addTransaction(input: {
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  date: string;
  note?: string;
  counterparty?: string;
}): Promise<Transaction> {
  const t: Transaction = {
    id: makeId(),
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    accountId: input.accountId,
    date: input.date,
    note: input.note?.trim() || undefined,
    counterparty: input.counterparty?.trim() || undefined,
    createdAt: nowISO(),
  };
  await db.transactions.add(t);
  return t;
}

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, 'amount' | 'categoryId' | 'accountId' | 'date' | 'note' | 'counterparty'>>,
) {
  await db.transactions.update(id, patch);
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

// ---------- Переводы между своими счетами ----------

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}): Promise<Transfer> {
  const transfer: Transfer = {
    id: makeId(),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    date: input.date,
    note: input.note?.trim() || undefined,
    createdAt: nowISO(),
  };
  await db.transfers.add(transfer);
  return transfer;
}

export async function deleteTransfer(id: string) {
  await db.transfers.delete(id);
}

// ---------- Люди (для долгов) ----------

export async function findOrCreatePerson(name: string): Promise<Person> {
  const trimmed = name.trim();
  const existing = await db.people.where('name').equalsIgnoreCase(trimmed).first();
  if (existing) return existing;
  const person: Person = { id: makeId(), name: trimmed, createdAt: nowISO() };
  await db.people.add(person);
  return person;
}

// ---------- Долги ----------

export async function createDebt(input: {
  personName: string;
  direction: DebtDirection;
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  linkedToBalance: boolean;
  accountId: string;
}): Promise<Debt> {
  const person = await findOrCreatePerson(input.personName);
  const debt: Debt = {
    id: makeId(),
    personId: person.id,
    direction: input.direction,
    initialAmount: input.amount,
    currentAmount: input.amount,
    date: input.date,
    dueDate: input.dueDate || undefined,
    note: input.note?.trim() || undefined,
    status: 'open',
    createdAt: nowISO(),
    linkedToBalance: input.linkedToBalance,
    accountId: input.accountId,
  };

  await db.transaction('rw', db.debts, db.transactions, async () => {
    await db.debts.add(debt);
    if (input.linkedToBalance) {
      // Одолжил кому-то (owed_to_me) -> деньги ушли из кармана -> расход.
      // Занял сам (i_owe) -> деньги пришли -> доход.
      const isOwedToMe = input.direction === 'owed_to_me';
      const t: Transaction = {
        id: makeId(),
        type: isOwedToMe ? 'expense' : 'income',
        amount: input.amount,
        categoryId: isOwedToMe ? SYSTEM_CATEGORY_IDS.debtGivenOut : SYSTEM_CATEGORY_IDS.debtReceived,
        accountId: input.accountId,
        date: input.date,
        note: i18n.t('historyText.debtTxNote', { name: person.name }),
        createdAt: nowISO(),
        debtId: debt.id,
      };
      await db.transactions.add(t);
    }
  });

  return debt;
}

export async function addDebtPayment(input: {
  debtId: string;
  amount: number;
  date: string;
  note?: string;
}) {
  await db.transaction('rw', db.debts, db.debtPayments, db.transactions, db.people, async () => {
    const debt = await db.debts.get(input.debtId);
    if (!debt) throw new Error('Долг не найден');
    const person = await db.people.get(debt.personId);
    const amount = Math.min(input.amount, debt.currentAmount);
    if (amount <= 0) return;

    const paymentId = makeId();
    await db.debtPayments.add({
      id: paymentId,
      debtId: debt.id,
      amount,
      date: input.date,
      note: input.note?.trim() || undefined,
      createdAt: nowISO(),
    });

    const newCurrent = Math.round((debt.currentAmount - amount) * 100) / 100;
    await db.debts.update(debt.id, {
      currentAmount: newCurrent,
      status: newCurrent <= 0 ? 'closed' : 'open',
      closedAt: newCurrent <= 0 ? nowISO() : undefined,
    });

    if (debt.linkedToBalance) {
      // Мне вернули (owed_to_me) -> доход. Я погасил свой долг (i_owe) -> расход.
      const isOwedToMe = debt.direction === 'owed_to_me';
      const t: Transaction = {
        id: makeId(),
        type: isOwedToMe ? 'income' : 'expense',
        amount,
        categoryId: isOwedToMe ? SYSTEM_CATEGORY_IDS.debtRepaymentIn : SYSTEM_CATEGORY_IDS.debtRepaymentOut,
        accountId: debt.accountId,
        date: input.date,
        note: i18n.t('historyText.debtPaymentTxNote', { name: person?.name ?? '' }),
        createdAt: nowISO(),
        debtId: debt.id,
        debtPaymentId: paymentId,
      };
      await db.transactions.add(t);
    }
  });
}

export async function writeOffDebt(debtId: string) {
  const debt = await db.debts.get(debtId);
  if (!debt) return;
  await db.debts.update(debtId, {
    currentAmount: 0,
    status: 'closed',
    writtenOff: true,
    writtenOffAmount: debt.currentAmount,
    closedAt: nowISO(),
  });
}

export async function reopenDebt(debtId: string) {
  const debt = await db.debts.get(debtId);
  if (!debt) return;
  const paid = await db.debtPayments.where({ debtId }).toArray();
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  await db.debts.update(debtId, {
    status: 'open',
    writtenOff: false,
    writtenOffAmount: undefined,
    closedAt: undefined,
    currentAmount: Math.max(0, Math.round((debt.initialAmount - paidTotal) * 100) / 100),
  });
}

export async function updateDebtDetails(
  debtId: string,
  patch: Partial<Pick<Debt, 'note' | 'dueDate'>>,
) {
  await db.debts.update(debtId, patch);
}

/** Включает/выключает учёт долга в балансе счёта задним числом. Выключение
 *  удаляет исходную операцию создания долга (доход/расход на initialAmount) —
 *  сам долг и история платежей по нему не трогаются. Включение создаёт эту
 *  операцию заново. Платежи по долгу продолжают появляться в балансе или нет
 *  в зависимости от актуального состояния этого флага на момент платежа. */
export async function setDebtLinkedToBalance(debtId: string, linked: boolean) {
  await db.transaction('rw', db.debts, db.transactions, db.people, async () => {
    const debt = await db.debts.get(debtId);
    if (!debt || debt.linkedToBalance === linked) return;

    if (!linked) {
      const creationTx = await db.transactions.where({ debtId }).filter((t) => !t.debtPaymentId).toArray();
      await db.transactions.bulkDelete(creationTx.map((t) => t.id));
    } else {
      const person = await db.people.get(debt.personId);
      const isOwedToMe = debt.direction === 'owed_to_me';
      const t: Transaction = {
        id: makeId(),
        type: isOwedToMe ? 'expense' : 'income',
        amount: debt.initialAmount,
        categoryId: isOwedToMe ? SYSTEM_CATEGORY_IDS.debtGivenOut : SYSTEM_CATEGORY_IDS.debtReceived,
        accountId: debt.accountId,
        date: debt.date,
        note: i18n.t('historyText.debtTxNote', { name: person?.name ?? '' }),
        createdAt: nowISO(),
        debtId: debt.id,
      };
      await db.transactions.add(t);
    }

    await db.debts.update(debtId, { linkedToBalance: linked });
  });
}

export async function deleteDebt(debtId: string) {
  await db.transaction('rw', db.debts, db.debtPayments, db.transactions, async () => {
    await db.transactions.where({ debtId }).delete();
    await db.debtPayments.where({ debtId }).delete();
    await db.debts.delete(debtId);
  });
}

export async function deleteDebtPayment(paymentId: string) {
  await db.transaction('rw', db.debts, db.debtPayments, db.transactions, async () => {
    const payment = await db.debtPayments.get(paymentId);
    if (!payment) return;
    const debt = await db.debts.get(payment.debtId);
    if (debt) {
      const newCurrent = Math.min(
        debt.initialAmount,
        Math.round((debt.currentAmount + payment.amount) * 100) / 100,
      );
      await db.debts.update(debt.id, {
        currentAmount: newCurrent,
        status: newCurrent > 0 ? 'open' : 'closed',
        closedAt: newCurrent > 0 ? undefined : debt.closedAt,
      });
    }
    await db.transactions.where({ debtPaymentId: paymentId }).delete();
    await db.debtPayments.delete(paymentId);
  });
}

// ---------- Очистка данных ----------

const ALL_TABLES = [
  db.categories,
  db.transactions,
  db.people,
  db.debts,
  db.debtPayments,
  db.settings,
  db.accounts,
  db.transfers,
  db.bills,
];

export async function clearAllData() {
  await db.transaction('rw', ALL_TABLES, async () => {
    await Promise.all([
      db.categories.clear(),
      db.transactions.clear(),
      db.people.clear(),
      db.debts.clear(),
      db.debtPayments.clear(),
      db.settings.clear(),
      db.accounts.clear(),
      db.transfers.clear(),
      db.bills.clear(),
    ]);
  });
}

export function defaultDate(): string {
  return todayISO();
}

// ---------- PIN-код (экран блокировки) ----------

export async function setPinCode(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  await db.settings.update(SETTINGS_ID, { pinHash: hash, pinSalt: salt, pinLength: pin.length });
}

export async function clearPinCode(): Promise<void> {
  await db.settings.update(SETTINGS_ID, { pinHash: undefined, pinSalt: undefined, pinLength: undefined });
}

export async function checkPinCode(pin: string): Promise<boolean> {
  const settings = await db.settings.get(SETTINGS_ID);
  if (!settings?.pinHash || !settings.pinSalt) return false;
  return verifyPin(pin, settings.pinSalt, settings.pinHash);
}

// ---------- Регулярные платежи (кредиты, тарифы, подписки) ----------

export async function createBill(input: {
  name: string;
  amount: number;
  dayOfMonth: number;
  firstDueDate: string;
  categoryId: string;
  accountId: string;
  icon: string;
  color: string;
  reminderDaysBefore: number;
  note?: string;
}): Promise<RecurringBill> {
  const bill: RecurringBill = {
    id: makeId(),
    name: input.name.trim(),
    amount: input.amount,
    dayOfMonth: input.dayOfMonth,
    firstDueDate: input.firstDueDate,
    categoryId: input.categoryId,
    accountId: input.accountId,
    icon: input.icon,
    color: input.color,
    reminderDaysBefore: input.reminderDaysBefore,
    isActive: true,
    note: input.note?.trim() || undefined,
    createdAt: nowISO(),
  };
  await db.bills.add(bill);
  return bill;
}

export async function updateBill(
  id: string,
  patch: Partial<
    Pick<RecurringBill, 'name' | 'amount' | 'dayOfMonth' | 'categoryId' | 'accountId' | 'icon' | 'color' | 'reminderDaysBefore' | 'note' | 'isActive'>
  >,
) {
  await db.bills.update(id, patch);
}

export async function deleteBill(id: string) {
  await db.bills.delete(id);
}

/** Отмечает платёж оплаченным в текущем месяце — создаёт обычную расходную
 *  операцию, привязанную к платежу (billId), так же как оплата долга. */
export async function markBillPaid(input: { billId: string; amount: number; date: string; note?: string }) {
  const bill = await db.bills.get(input.billId);
  if (!bill) throw new Error('Платёж не найден');
  const t: Transaction = {
    id: makeId(),
    type: 'expense',
    amount: input.amount,
    categoryId: bill.categoryId,
    accountId: bill.accountId,
    date: input.date,
    note: input.note?.trim() || bill.name,
    createdAt: nowISO(),
    billId: bill.id,
  };
  await db.transactions.add(t);
}
