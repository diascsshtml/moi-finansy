import Dexie, { type Table } from 'dexie';
import type {
  Account,
  AppSettings,
  Category,
  Debt,
  DebtPayment,
  Person,
  RecurringBill,
  Transaction,
  Transfer,
} from '../types';
import { SYSTEM_ACCOUNT_IDS } from './constants';

export class FinanceDB extends Dexie {
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  people!: Table<Person, string>;
  debts!: Table<Debt, string>;
  debtPayments!: Table<DebtPayment, string>;
  settings!: Table<AppSettings, string>;
  accounts!: Table<Account, string>;
  transfers!: Table<Transfer, string>;
  bills!: Table<RecurringBill, string>;

  constructor() {
    super('personalFinanceDB');

    this.version(1).stores({
      categories: 'id, type, isSystem, order',
      transactions: 'id, type, categoryId, date, debtId, createdAt',
      people: 'id, name',
      debts: 'id, personId, direction, status, date',
      debtPayments: 'id, debtId, date',
      settings: 'id',
    });

    // v2: счета (Личное/Бизнес) — у операций и долгов появляется accountId,
    // плюс переводы денег между счетами. Для уже установленного приложения
    // (с существующими данными) создаём счета по умолчанию и проставляем
    // старым операциям/долгам счёт «Личное», чтобы ничего не потерялось.
    this.version(2)
      .stores({
        categories: 'id, type, isSystem, order',
        transactions: 'id, type, categoryId, date, debtId, createdAt, accountId',
        people: 'id, name',
        debts: 'id, personId, direction, status, date, accountId',
        debtPayments: 'id, debtId, date',
        settings: 'id',
        accounts: 'id, order',
        transfers: 'id, fromAccountId, toAccountId, date',
      })
      .upgrade(async (tx) => {
        const accounts = tx.table<Account, string>('accounts');
        if ((await accounts.count()) === 0) {
          await accounts.bulkAdd([
            {
              id: SYSTEM_ACCOUNT_IDS.personal,
              name: 'Личное',
              nameKey: 'accountNames.personal',
              icon: '👤',
              color: '#2a78d6',
              order: 0,
              isSystem: true,
            },
            {
              id: SYSTEM_ACCOUNT_IDS.business,
              name: 'Бизнес',
              nameKey: 'accountNames.business',
              icon: '💼',
              color: '#4a3aa7',
              order: 1,
              isSystem: true,
            },
          ]);
        }
        await tx
          .table<Transaction, string>('transactions')
          .toCollection()
          .modify((t) => {
            if (!t.accountId) t.accountId = SYSTEM_ACCOUNT_IDS.personal;
          });
        await tx
          .table<Debt, string>('debts')
          .toCollection()
          .modify((d) => {
            if (!d.accountId) d.accountId = SYSTEM_ACCOUNT_IDS.personal;
          });
      });

    // v3: обязательные регулярные платежи (кредиты, тарифы, подписки).
    this.version(3).stores({
      categories: 'id, type, isSystem, order',
      transactions: 'id, type, categoryId, date, debtId, billId, createdAt, accountId',
      people: 'id, name',
      debts: 'id, personId, direction, status, date, accountId',
      debtPayments: 'id, debtId, date',
      settings: 'id',
      accounts: 'id, order',
      transfers: 'id, fromAccountId, toAccountId, date',
      bills: 'id, isActive, dayOfMonth',
    });
  }
}

export const db = new FinanceDB();
