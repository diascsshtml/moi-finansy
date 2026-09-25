import type { TFunction } from 'i18next';
import { db } from '../db/db';
import { buildHistory } from './history';
import { getAccountBalances } from './stats';
import { getAllBillStatuses, getDueRelativeLabel } from './bills';
import { categoryDisplayName, accountDisplayName } from './displayName';
import { dateToISO, formatDateShort, todayISO } from './format';
import type { HistoryEntryKind } from '../types';
import { buildXlsx, type SheetDef } from './xlsxWriter';

const SIGNED_NEGATIVE_KINDS: HistoryEntryKind[] = ['expense', 'debt_written_off'];

/** Собирает все данные приложения (операции, долги, платежи, счета) в один
 *  .xlsx-файл с несколькими листами и запускает скачивание. Работает
 *  полностью локально — файл собирается в браузере, никуда не отправляется. */
export async function exportDataToExcel(t: TFunction, currency: string): Promise<void> {
  const [transactions, debts, debtPayments, people, categories, transfers, accounts, bills] = await Promise.all([
    db.transactions.toArray(),
    db.debts.toArray(),
    db.debtPayments.toArray(),
    db.people.toArray(),
    db.categories.toArray(),
    db.transfers.toArray(),
    db.accounts.orderBy('order').toArray(),
    db.bills.toArray(),
  ]);

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const kindLabel: Record<HistoryEntryKind, string> = {
    income: t('history.typeIncome'),
    expense: t('history.typeExpense'),
    debt_created: t('history.typeDebt'),
    debt_payment: t('history.typeDebt'),
    debt_written_off: t('history.typeDebt'),
    transfer: t('history.typeTransfer'),
  };

  const history = buildHistory(transactions, debts, debtPayments, people, categories, transfers, accounts, t);
  // Отдельный лист операций на каждый счёт — иначе личные и бизнес-операции
  // мешаются в одной большой таблице и её неудобно читать.
  const operationsHeaders = [
    t('excelExport.colDate'),
    t('excelExport.colType'),
    t('excelExport.colTitle'),
    t('excelExport.colCounterparty'),
    t('excelExport.colNote'),
    `${t('excelExport.colAmount')} (${currency})`,
  ];
  const operationsSheets: SheetDef[] = accounts.map((account) => ({
    name: `${t('excelExport.sheetOperations')} — ${accountDisplayName(account, t)}`,
    headers: operationsHeaders,
    rows: history
      .filter((e) => e.accountId === account.id)
      .map((e) => [
        formatDateShort(e.date),
        kindLabel[e.kind],
        e.title,
        e.transaction?.counterparty ?? '',
        (e.transaction ? e.transaction.note : e.subtitle) ?? '',
        SIGNED_NEGATIVE_KINDS.includes(e.kind) ? -e.amount : e.amount,
      ]),
  }));

  const debtsSheet: SheetDef = {
    name: t('excelExport.sheetDebts'),
    headers: [
      t('excelExport.colPerson'),
      t('excelExport.colDirection'),
      `${t('excelExport.colInitialAmount')} (${currency})`,
      `${t('excelExport.colRemaining')} (${currency})`,
      t('excelExport.colStatus'),
      t('excelExport.colDueDate'),
      t('excelExport.colAccount'),
    ],
    rows: debts.map((d) => {
      const person = people.find((p) => p.id === d.personId);
      const status =
        d.status === 'open'
          ? t('excelExport.statusOpen')
          : d.writtenOff
            ? t('debts.badgeWrittenOff')
            : t('debts.badgeClosed');
      return [
        person?.name ?? '',
        d.direction === 'owed_to_me' ? t('debts.owedToMe') : t('debts.iOwe'),
        d.initialAmount,
        d.currentAmount,
        status,
        d.dueDate ? formatDateShort(d.dueDate) : '',
        accountDisplayName(accountsById.get(d.accountId), t),
      ];
    }),
  };

  const billStatuses = getAllBillStatuses(bills, transactions);
  const billsSheet: SheetDef = {
    name: t('excelExport.sheetBills'),
    headers: [
      t('excelExport.colTitle'),
      `${t('excelExport.colAmount')} (${currency})`,
      t('excelExport.colDayOfMonth'),
      t('excelExport.colCategory'),
      t('excelExport.colAccount'),
      t('excelExport.colNextDue'),
      t('excelExport.colStatus'),
    ],
    rows: billStatuses.map((s) => [
      s.bill.name,
      s.bill.amount,
      s.bill.dayOfMonth,
      categoryDisplayName(categoriesById.get(s.bill.categoryId), t),
      accountDisplayName(accountsById.get(s.bill.accountId), t),
      formatDateShort(dateToISO(s.dueDate)),
      s.status === 'paused' ? t('bills.pausedBadge') : s.status === 'paid' ? t('bills.paidBadge') : getDueRelativeLabel(s, t),
    ]),
  };

  const balances = getAccountBalances(transactions, transfers);
  const accountsSheet: SheetDef = {
    name: t('excelExport.sheetAccounts'),
    headers: [t('excelExport.colAccount'), t('excelExport.colBank'), `${t('excelExport.colBalance')} (${currency})`],
    rows: accounts.map((a) => [accountDisplayName(a, t), a.bank ?? '', balances.get(a.id) ?? 0]),
  };

  const bytes = buildXlsx([...operationsSheets, debtsSheet, billsSheet, accountsSheet]);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-export-${todayISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
