// Синхронизация финансовых данных с сервером (см. worker/accounts-api.ts).
// Модель максимально простая — полный снимок, а не построчное слияние:
// при входе сервер целиком заменяет локальную базу, при каждом изменении
// клиент целиком перезаписывает снимок на сервере. Для одного человека,
// использующего свои устройства по очереди (а не двух людей, правящих
// данные одновременно на двух телефонах), это надёжно и без риска
// конфликтов слияния — но именно поэтому одновременная работа с двух
// устройств может привести к тому, что синхронизировавшееся последним
// устройство "победит" целиком. Настройки (тема, PIN, валюта, язык)
// сознательно остаются только на устройстве — не синхронизируются.

import { db } from '../db/db';
import type { Account, Category, Debt, DebtPayment, Person, RecurringBill, Transaction, Transfer } from '../types';

interface DataSnapshot {
  categories: Category[];
  transactions: Transaction[];
  people: Person[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  accounts: Account[];
  transfers: Transfer[];
  bills: RecurringBill[];
}

async function readLocalSnapshot(): Promise<DataSnapshot> {
  const [categories, transactions, people, debts, debtPayments, accounts, transfers, bills] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
    db.people.toArray(),
    db.debts.toArray(),
    db.debtPayments.toArray(),
    db.accounts.toArray(),
    db.transfers.toArray(),
    db.bills.toArray(),
  ]);
  return { categories, transactions, people, debts, debtPayments, accounts, transfers, bills };
}

const SYNCED_TABLES = [db.categories, db.transactions, db.people, db.debts, db.debtPayments, db.accounts, db.transfers, db.bills];

async function replaceLocalData(snapshot: DataSnapshot): Promise<void> {
  await db.transaction('rw', SYNCED_TABLES, async () => {
    await Promise.all([
      db.categories.clear(),
      db.transactions.clear(),
      db.people.clear(),
      db.debts.clear(),
      db.debtPayments.clear(),
      db.accounts.clear(),
      db.transfers.clear(),
      db.bills.clear(),
    ]);
    await Promise.all([
      db.categories.bulkAdd(snapshot.categories ?? []),
      db.transactions.bulkAdd(snapshot.transactions ?? []),
      db.people.bulkAdd(snapshot.people ?? []),
      db.debts.bulkAdd(snapshot.debts ?? []),
      db.debtPayments.bulkAdd(snapshot.debtPayments ?? []),
      db.accounts.bulkAdd(snapshot.accounts ?? []),
      db.transfers.bulkAdd(snapshot.transfers ?? []),
      db.bills.bulkAdd(snapshot.bills ?? []),
    ]);
  });
}

/** Выгружает текущую локальную базу на сервер целиком (перезаписывает то,
 *  что там было). Вызывается после каждого изменения (см. syncScheduler) и
 *  один раз сразу после регистрации, чтобы не потерять то, что уже
 *  накопилось локально до создания аккаунта. */
export async function pushSnapshotToServer(): Promise<void> {
  const snapshot = await readLocalSnapshot();
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ snapshot }),
  });
  if (!res.ok) throw new Error(`Не удалось сохранить на сервере (${res.status})`);
}

/** Забирает снимок с сервера и заменяет им локальную базу — используется при
 *  входе. Если на сервере ещё ничего нет (новый аккаунт без данных),
 *  ничего не делает — оставляет локальные данные как есть. Синхронизацию на
 *  время замены отключаем — иначе сама замена (clear+bulkAdd через хуки)
 *  тут же запланировала бы отправку этих же данных обратно на сервер. */
export async function pullSnapshotFromServer(): Promise<void> {
  const res = await fetch('/api/data', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Не удалось получить данные с сервера (${res.status})`);
  const body = (await res.json()) as { snapshot: DataSnapshot | null };
  if (!body.snapshot) return;
  const wasEnabled = syncEnabled;
  syncEnabled = false;
  try {
    await replaceLocalData(body.snapshot);
  } finally {
    syncEnabled = wasEnabled;
  }
}

/** Полностью стирает локальные финансовые данные — используется при выходе
 *  из аккаунта, чтобы на этом устройстве не оставались чужие данные (если
 *  им потом пользуется кто-то другой без входа, или заходит другой аккаунт).
 *  Синхронизацию на время очистки отключаем — иначе сама очистка (clear
 *  через хуки) тут же запланировала бы отправку уже пустого снимка на
 *  сервер, стирая то, что там было сохранено. */
export async function clearLocalData(): Promise<void> {
  const wasEnabled = syncEnabled;
  syncEnabled = false;
  try {
    await db.transaction('rw', SYNCED_TABLES, async () => {
      await Promise.all([
        db.categories.clear(),
        db.transactions.clear(),
        db.people.clear(),
        db.debts.clear(),
        db.debtPayments.clear(),
        db.accounts.clear(),
        db.transfers.clear(),
        db.bills.clear(),
      ]);
    });
  } finally {
    syncEnabled = wasEnabled;
  }
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let syncEnabled = false;

export function setSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled;
}

/** Планирует выгрузку на сервер с небольшой задержкой (чтобы несколько
 *  быстрых изменений подряд не отправляли по отдельному запросу на каждое).
 *  Тихо игнорирует ошибки сети — следующее изменение попробует снова;
 *  данные при этом остаются целы локально в любом случае. */
export function scheduleSync(): void {
  if (!syncEnabled) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void pushSnapshotToServer().catch(() => {
      // офлайн или сервер недоступен — переживём, следующее изменение попробует снова
    });
  }, 1200);
}

let hooksRegistered = false;

/** Регистрирует хуки Dexie на все синхронизируемые таблицы — вызывается один
 *  раз при старте приложения. Так scheduleSync() срабатывает на КАЖДОЕ
 *  изменение (через любую функцию в db/operations.ts, нынешнюю или будущую),
 *  без необходимости помнить о вызове синхронизации в каждой из них по отдельности. */
export function initSyncHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;
  for (const table of SYNCED_TABLES) {
    table.hook('creating', () => scheduleSync());
    table.hook('updating', () => scheduleSync());
    table.hook('deleting', () => scheduleSync());
  }
}
