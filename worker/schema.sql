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
  -- Фамилия и отчество — отдельные поля (не часть name), чтобы форма
  -- профиля (три отдельных поля) могла корректно показать их обратно при
  -- следующем открытии, а не склеивать всё в одну строку и терять разбивку.
  last_name TEXT,
  patronymic TEXT,
  email TEXT,
  -- Фото профиля — уменьшенная и сжатая на клиенте картинка (см.
  -- utils/imageResize.ts), целиком как data URL (data:image/jpeg;base64,...).
  -- NULL — используется дефолтный значок с инициалами/иконкой.
  avatar TEXT,
  -- Телефон — необязательный, редактируется на странице профиля. NULL —
  -- не указан.
  phone TEXT,
  -- Токен для приёма платежей из Shortcuts-автоматизации (см.
  -- worker/applepay.ts, worker/auth.ts: generateToken/sha256Hex) — хранится
  -- только как SHA-256-хэш, сам токен виден пользователю один раз, в момент
  -- генерации. NULL — интеграция не настроена.
  apple_pay_token_hash TEXT,
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

-- Дневные снимки курсов валют (НацБанк РК) и крипты (CoinGecko, пересчитано
-- в тенге по курсу USD/KZT того же дня) — общие для всех пользователей, не
-- привязаны к user_id. Наполняются часовым cron (см. worker/rates.ts:
-- recordDailySnapshot — пишет не чаще раза в день) и разовым бэкфиллом за
-- прошлые даты через /api/admin/rates-backfill. Нужны для графиков истории
-- на странице «Финансы» (sparkline в списке, большой график на странице актива).
CREATE TABLE IF NOT EXISTS rate_history (
  date DATE NOT NULL,
  kind TEXT NOT NULL, -- 'currency' | 'crypto'
  code TEXT NOT NULL, -- код валюты (USD) или id монеты CoinGecko (bitcoin)
  price_kzt NUMERIC NOT NULL,
  change_pct NUMERIC,
  PRIMARY KEY (date, kind, code)
);
CREATE INDEX IF NOT EXISTS rate_history_lookup ON rate_history (kind, code, date);

-- Уникальный индекс для быстрого (индексированного) поиска пользователя по
-- хэшу токена Apple Pay при каждом вызове вебхука — без него пришлось бы
-- перебирать всех пользователей. NULL допускает сколько угодно пользователей
-- без включённой интеграции (частичный индекс их не учитывает).
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_pay_token_hash_idx ON users (apple_pay_token_hash) WHERE apple_pay_token_hash IS NOT NULL;

-- Платежи, присланные Shortcuts-автоматизацией в фоне (см. worker/applepay.ts),
-- пока ещё не подхвачены ни одним устройством пользователя. Клиент при
-- открытии приложения забирает все свои строки (GET), создаёт из них обычные
-- операции локально, отправляет обновлённый снимок на сервер и только потом
-- подтверждает (POST .../ack) — так платёж не потеряется, если приложение
-- закроется посередине.
CREATE TABLE IF NOT EXISTS pending_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount NUMERIC NOT NULL,
  merchant TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pending_transactions_user_idx ON pending_transactions (user_id);
