// Список зарегистрированных клиентов и (по запросу) их финансовый снимок —
// доступно только владельцу приложения по отдельному секретному ключу (не
// паролю аккаунта), см. worker/accounts-api.ts.

import type { Account, Category, Debt, DebtPayment, Person, RecurringBill, Transaction, Transfer } from '../types';

export interface AdminUser {
  username: string;
  name: string;
  email: string | null;
  created_at: string;
}

export interface AdminDataSnapshot {
  categories: Category[];
  transactions: Transaction[];
  people: Person[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  accounts: Account[];
  transfers: Transfer[];
  bills: RecurringBill[];
}

async function adminFetch<T>(path: string, key: string): Promise<T> {
  const res = await fetch(path, {
    headers: { 'X-Admin-Key': key },
    credentials: 'same-origin',
  });
  if (res.status === 401) throw new Error('Неверный ключ');
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchAdminUsers(key: string): Promise<AdminUser[]> {
  const body = await adminFetch<{ users: AdminUser[] }>('/api/admin/users', key);
  return body.users;
}

export async function fetchAdminUserData(
  key: string,
  username: string,
): Promise<{ snapshot: AdminDataSnapshot | null; updatedAt: string | null }> {
  return adminFetch(`/api/admin/users/${encodeURIComponent(username)}/data`, key);
}
