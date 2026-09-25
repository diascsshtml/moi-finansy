-- Схема для аккаунтов и синхронизации финансовых данных между устройствами.
-- Одна запись на пользователя в каждой финансовой таблице (JSON-снимок) —
-- см. dataSync.ts: клиент целиком выгружает/загружает свою базу Dexie, без
-- построчного слияния (последнее устройство, которое синхронизировалось,
-- "выигрывает" целиком).
--
-- Основная база — Postgres (Neon), подключение через DATABASE_URL (секрет
-- воркера) и @neondatabase/serverless (см. worker/accounts-api.ts). Старая
-- база в Cloudflare D1 (moi-finansy-db) оставлена как резервная копия — код
-- её больше не использует, но данные там ещё есть на случай отката. Схема
-- ниже совместима с обеими (SQLite/Postgres) без изменений.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  -- Восстановление пароля — по коду на почту (см. worker/accounts-api.ts,
  -- worker/email.ts): запрос кода шлёт письмо через Brevo, код хранится
  -- здесь только в виде хэша (как пароль) и живёт RESET_CODE_TTL_MS, дальше
  -- поля очищаются. Аккаунты без email (заведённые до этой функции)
  -- восстановить так нельзя, пока владелец не добавит почту в Настройках.
  reset_code_hash TEXT,
  reset_code_salt TEXT,
  reset_code_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  snapshot TEXT NOT NULL, -- JSON: { categories, transactions, people, debts, debtPayments, accounts, transfers, bills }
  updated_at TEXT NOT NULL
);
