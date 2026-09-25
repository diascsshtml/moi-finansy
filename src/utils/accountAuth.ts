// Настоящий аккаунт с логином/паролем — чтобы заходить с любого устройства.
// В отличие от PIN-кода (Настройки → Экран блокировки, чисто локальный замок
// на этом устройстве), это реальная авторизация на сервере: финансовые
// данные (операции, долги, счета, платежи) хранятся в облаке и подтягиваются
// при входе — см. dataSync.ts.

export interface AuthUser {
  username: string;
  name: string;
  email: string | null;
  createdAt?: string;
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    return await api<AuthUser>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function register(name: string, username: string, password: string, email: string): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, username, password, email }) });
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

/** Шаг 1 восстановления пароля — просит сервер прислать код на почту,
 *  привязанную к логину. */
export async function requestPasswordReset(username: string): Promise<void> {
  await api<{ ok: true }>('/api/auth/request-reset', { method: 'POST', body: JSON.stringify({ username }) });
}

/** Шаг 2 — код из письма + новый пароль. */
export async function confirmPasswordReset(username: string, code: string, newPassword: string): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/confirm-reset', { method: 'POST', body: JSON.stringify({ username, code, newPassword }) });
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

export async function updateName(name: string): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/name', { method: 'PUT', body: JSON.stringify({ name }) });
}

export async function updateEmail(email: string): Promise<AuthUser> {
  return api<AuthUser>('/api/auth/email', { method: 'PUT', body: JSON.stringify({ email }) });
}
