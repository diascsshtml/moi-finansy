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

-- Push-подписки устройств (замена анонимному KV-хранилищу PUSH_SUBS — теперь
-- привязаны к аккаунту, чтобы часовой cron (см. worker/notifications.ts) мог
-- сопоставить подписку с настройками уведомлений и реальными платежами
-- именно этого пользователя, а не слать всем один и тот же текст.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Настройки уведомлений — одна строка на пользователя. bills_days_before
-- хранит JSON-массив чисел (напр. "[2,1]" — напомнить за 2 дня и за 1 день);
-- 0 в массиве означает «в день платежа». timezone — IANA-строка (напр.
-- "Asia/Almaty"), присылается браузером при первой подписке, нужна серверу,
-- чтобы понимать, что для пользователя сейчас именно daily_time/bills_time
-- по его локальному времени, а не по UTC.
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  timezone TEXT NOT NULL DEFAULT 'Asia/Almaty',
  daily_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_time TEXT NOT NULL DEFAULT '20:00',
  bills_enabled BOOLEAN NOT NULL DEFAULT false,
  bills_days_before TEXT NOT NULL DEFAULT '[1]',
  bills_time TEXT NOT NULL DEFAULT '10:00',
  updated_at TEXT NOT NULL
);
