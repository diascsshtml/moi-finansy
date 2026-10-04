// Клиентская часть интеграции с Apple Pay через Shortcuts-автоматизацию —
// см. worker/applepay.ts про сам вебхук и серверное хранилище. Здесь —
// управление токеном и подхват платежей, присланных в фоне.

import { db } from '../db/db';
import { SETTINGS_ID, SYSTEM_ACCOUNT_IDS, SYSTEM_CATEGORY_IDS } from '../db/constants';
import { addTransaction } from '../db/operations';
import { pushSnapshotToServer } from './dataSync';
import { dateToISO } from './format';
import i18n from '../i18n';

interface PendingTransaction {
  id: string;
  amount: string | number; // Postgres NUMERIC приходит строкой через JSON
  merchant: string | null;
  occurred_at: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Ошибка ${res.status}`);
  }
  return body;
}

/** Выпускает новый токен для вставки в команду Shortcuts — виден только в
 *  этом ответе, дальше сервер хранит только его хэш. Повторный вызов тихо
 *  аннулирует предыдущий токен (старая команда перестанет работать). */
export async function generateApplePayToken(): Promise<string> {
  const body = await api<{ token: string }>('/api/auth/apple-pay-token', { method: 'POST' });
  return body.token;
}

export async function revokeApplePayToken(): Promise<void> {
  await api('/api/auth/apple-pay-token', { method: 'DELETE' });
}

export async function getApplePayStatus(): Promise<boolean> {
  const body = await api<{ enabled: boolean }>('/api/auth/apple-pay-token');
  return body.enabled;
}

/** Забирает платежи, присланные Shortcuts в фоне (пока приложение не было
 *  открыто), создаёт из них обычные расходные операции локально — счёт из
 *  настройки applePayAccountId (или первый по порядку, если не выбран),
 *  категория «Прочее» (авто-категоризация по продавцу — не делаем: рискует
 *  угадать неверно; имя продавца сохраняется в поле «контрагент», дальше
 *  пользователь сам перенесёт в нужную категорию при желании). Отправляет
 *  обновлённый снимок на сервер и только потом подтверждает получение —
 *  если push не удался (офлайн, конфликт синхронизации), платежи остаются
 *  непрочитанными и будут подхвачены заново при следующей попытке. */
export async function syncPendingApplePayTransactions(): Promise<number> {
  const { items } = await api<{ items: PendingTransaction[] }>('/api/transactions/pending');
  if (items.length === 0) return 0;

  const settings = await db.settings.get(SETTINGS_ID);
  const accounts = await db.accounts.orderBy('order').toArray();
  const accountId =
    settings?.applePayAccountId && accounts.some((a) => a.id === settings.applePayAccountId)
      ? settings.applePayAccountId
      : (accounts[0]?.id ?? SYSTEM_ACCOUNT_IDS.personal);

  for (const item of items) {
    await addTransaction({
      type: 'expense',
      amount: Number(item.amount),
      categoryId: SYSTEM_CATEGORY_IDS.otherExpense,
      accountId,
      date: dateToISO(new Date(item.occurred_at)),
      counterparty: item.merchant ?? undefined,
      note: i18n.t('settings.applePay.importedNote'),
    });
  }

  await pushSnapshotToServer();
  await api('/api/transactions/pending/ack', { method: 'POST', body: JSON.stringify({ ids: items.map((i) => i.id) }) });
  return items.length;
}
