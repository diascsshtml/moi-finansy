// Курсы валют — официальный бесплатный XML-фид Нацбанка РК, без ключа.
// Крипта — бесплатный CoinGecko simple/price (без ключа), в USD, пересчитываем
// в тенге сами через курс USD/KZT того же дня (CoinGecko не знает тенге).
// Воркер здесь нужен и как прокси (NBRK/CoinGecko не шлют CORS-заголовки —
// напрямую из браузера не получить), и как хранилище дневной истории
// (rate_history в Postgres) для графиков на странице «Финансы».

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { constantTimeEqual } from './auth';

export interface RatesEnv {
  DATABASE_URL: string;
  RATES_BACKFILL_KEY: string;
}

export interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
  quant: number;
  change: number;
}

export interface CryptoRate {
  code: string; // id CoinGecko, напр. "bitcoin"
  symbol: string; // "BTC"
  name: string;
  priceKzt: number;
  changePct: number;
}

// Крипта, которую показываем — CoinGecko id -> (symbol, русское имя).
const CRYPTO_ASSETS: Array<{ id: string; symbol: string; name: string }> = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

function xmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function parseRatesXml(xml: string): CurrencyRate[] {
  const items: CurrencyRate[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const code = xmlTag(block, 'title');
    const name = xmlTag(block, 'fullname');
    const rate = Number(xmlTag(block, 'description'));
    const quant = Number(xmlTag(block, 'quant')) || 1;
    const change = Number(xmlTag(block, 'change')) || 0;
    if (code && Number.isFinite(rate)) items.push({ code, name, rate, quant, change });
  }
  return items;
}

function formatDateForNbrk(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
}

function nbrkDateToIso(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('.');
  return `${y}-${m}-${d}`;
}

async function fetchNbrkRatesForDate(ddmmyyyy: string): Promise<CurrencyRate[]> {
  const res = await fetch(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${ddmmyyyy}`);
  if (!res.ok) throw new Error(`NBRK вернул ${res.status}`);
  return parseRatesXml(await res.text());
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

function errorJson(e: unknown, status = 502): Response {
  return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleRatesApi(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/rates' || request.method !== 'GET') return null;
  const fdate = formatDateForNbrk(new Date());
  try {
    const rates = await fetchNbrkRatesForDate(fdate);
    return json({ date: fdate, rates });
  } catch (e) {
    return errorJson(e);
  }
}

async function fetchCryptoUsdPrices(): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const ids = CRYPTO_ASSETS.map((c) => c.id).join(',');
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; moi-finansy/1.0)', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko вернул ${res.status}`);
  return res.json();
}

export async function handleCryptoRatesApi(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/rates/crypto' || request.method !== 'GET') return null;
  try {
    const fdate = formatDateForNbrk(new Date());
    const [currencyRates, usdPrices] = await Promise.all([fetchNbrkRatesForDate(fdate), fetchCryptoUsdPrices()]);
    const usd = currencyRates.find((r) => r.code === 'USD');
    if (!usd) throw new Error('Курс USD не найден');
    const usdToKzt = usd.rate / usd.quant;
    const rates: CryptoRate[] = CRYPTO_ASSETS.map((c) => {
      const p = usdPrices[c.id];
      return {
        code: c.id,
        symbol: c.symbol,
        name: c.name,
        priceKzt: (p?.usd ?? 0) * usdToKzt,
        changePct: p?.usd_24h_change ?? 0,
      };
    });
    return json({ date: fdate, rates });
  } catch (e) {
    return errorJson(e);
  }
}

const RANGE_DAYS: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };

export async function handleRateHistoryApi(request: Request, env: RatesEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/rates/history' || request.method !== 'GET') return null;
  const kind = url.searchParams.get('kind');
  const code = url.searchParams.get('code');
  const range = url.searchParams.get('range') ?? '1M';
  if ((kind !== 'currency' && kind !== 'crypto') || !code) {
    return json({ error: 'missing kind/code' }, 400);
  }
  const days = RANGE_DAYS[range] ?? 30;
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql`
      SELECT date, price_kzt, change_pct FROM rate_history
      WHERE kind = ${kind} AND code = ${code} AND date >= CURRENT_DATE - ${days}::integer
      ORDER BY date ASC
    `) as Array<{ date: string; price_kzt: string; change_pct: string | null }>;
    return json({
      points: rows.map((r) => ({ date: r.date, price: Number(r.price_kzt), changePct: r.change_pct == null ? null : Number(r.change_pct) })),
    });
  } catch (e) {
    // Таблицы ещё может не быть (миграция не применена) — отдаём пустую
    // историю вместо 500, чтобы страница не падала, а показывала "нет данных".
    return json({ points: [], error: e instanceof Error ? e.message : String(e) });
  }
}

/** Пишет сегодняшний снимок курсов+крипты в rate_history, но не чаще раза в
 *  день (если на сегодня уже есть строка для USD — выходим сразу). Вызывается
 *  из часового cron (worker/index.ts: scheduled) — большинство запусков в
 *  течение дня будут no-op. */
export async function recordDailySnapshot(env: RatesEnv): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  const fdate = formatDateForNbrk(new Date());
  const iso = nbrkDateToIso(fdate);

  const existing = (await sql`SELECT 1 FROM rate_history WHERE date = ${iso} AND kind = 'currency' AND code = 'USD'`) as unknown[];
  if (existing.length > 0) return;

  const rates = await fetchNbrkRatesForDate(fdate);
  await upsertCurrencyDay(sql, iso, rates);

  const usd = rates.find((r) => r.code === 'USD');
  if (usd) {
    try {
      const usdToKzt = usd.rate / usd.quant;
      const usdPrices = await fetchCryptoUsdPrices();
      const rows = CRYPTO_ASSETS.map((c) => {
        const p = usdPrices[c.id];
        return { code: c.id, priceKzt: (p?.usd ?? 0) * usdToKzt, changePct: p?.usd_24h_change ?? null };
      }).filter((r) => r.priceKzt > 0);
      await upsertCryptoDay(sql, iso, rows);
    } catch {
      // Крипта необязательна для дневного снимка — если CoinGecko недоступен,
      // валютная история всё равно уже записана.
    }
  }

  // Заодно подтягиваем до RATES_BACKFILL_BATCH дней недостающей истории в
  // прошлое — так через ~15-20 часовых тиков после первого деплоя набирается
  // полный год без ручного вмешательства (ручной бэкфилл через
  // /api/admin/rates-backfill просто ускоряет это сразу после релиза).
  await backfillMissingDays(sql, 20);
}

type SqlFn = NeonQueryFunction<false, false>;

async function upsertCurrencyDay(sql: SqlFn, iso: string, rates: CurrencyRate[]): Promise<void> {
  if (rates.length === 0) return;
  const dates = rates.map(() => iso);
  const kinds = rates.map(() => 'currency');
  const codes = rates.map((r) => r.code);
  const prices = rates.map((r) => r.rate / r.quant);
  const changes = rates.map((r) => r.change);
  await sql`
    INSERT INTO rate_history (date, kind, code, price_kzt, change_pct)
    SELECT * FROM unnest(${dates}::date[], ${kinds}::text[], ${codes}::text[], ${prices}::numeric[], ${changes}::numeric[])
    AS t(date, kind, code, price_kzt, change_pct)
    ON CONFLICT (date, kind, code) DO UPDATE SET price_kzt = excluded.price_kzt, change_pct = excluded.change_pct
  `;
}

async function upsertCryptoDay(sql: SqlFn, iso: string, rows: Array<{ code: string; priceKzt: number; changePct: number | null }>): Promise<void> {
  if (rows.length === 0) return;
  const dates = rows.map(() => iso);
  const kinds = rows.map(() => 'crypto');
  const codes = rows.map((r) => r.code);
  const prices = rows.map((r) => r.priceKzt);
  const changes = rows.map((r) => r.changePct);
  await sql`
    INSERT INTO rate_history (date, kind, code, price_kzt, change_pct)
    SELECT * FROM unnest(${dates}::date[], ${kinds}::text[], ${codes}::text[], ${prices}::numeric[], ${changes}::numeric[])
    AS t(date, kind, code, price_kzt, change_pct)
    ON CONFLICT (date, kind, code) DO UPDATE SET price_kzt = excluded.price_kzt, change_pct = excluded.change_pct
  `;
}

/** Докатывает историю валют в прошлое: берёт самую старую записанную дату (или
 *  сегодня, если таблица пуста) и запрашивает у NBRK ещё до `batch` дней
 *  раньше неё, пока не наберётся год. Один день = один XML-ответ NBRK со
 *  всеми валютами сразу, поэтому это дёшево даже пачками по 20-30. */
async function backfillMissingDays(sql: SqlFn, batch: number): Promise<number> {
  const oldestRows = (await sql`SELECT MIN(date) AS d FROM rate_history WHERE kind = 'currency'`) as Array<{ d: string | null }>;
  const oldest = oldestRows[0]?.d ? new Date(oldestRows[0].d) : new Date();
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  if (oldest <= yearAgo) return 0; // уже есть полный год

  let inserted = 0;
  const cursor = new Date(oldest);
  for (let i = 0; i < batch; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor < yearAgo) break;
    const ddmmyyyy = formatDateForNbrk(cursor);
    const iso = nbrkDateToIso(ddmmyyyy);
    try {
      const rates = await fetchNbrkRatesForDate(ddmmyyyy);
      if (rates.length > 0) {
        await upsertCurrencyDay(sql, iso, rates);
        inserted++;
      }
    } catch {
      // Один неудачный день (например, NBRK не публиковал курс на выходной)
      // не должен останавливать весь бэкфилл — идём дальше в прошлое.
    }
  }
  return inserted;
}

/** Разовый бэкфилл истории крипты — CoinGecko отдаёт до 365 дневных точек в
 *  USD одним запросом на монету. Каждую точку переводим в тенге по курсу
 *  USD/KZT того же дня из уже накопленной валютной истории (ближайшая не
 *  более поздняя дата — на случай расхождения календарей). Вызывается только
 *  вручную через /api/admin/rates-backfill, когда валютная история уже
 *  покрывает нужный период. */
async function backfillCryptoHistory(sql: SqlFn, coinId: string): Promise<number> {
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; moi-finansy/1.0)', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko вернул ${res.status}`);
  const body = (await res.json()) as { prices: Array<[number, number]> };

  const usdRowsRaw = (await sql`SELECT date, price_kzt FROM rate_history WHERE kind = 'currency' AND code = 'USD' ORDER BY date ASC`) as Array<{
    date: string | Date;
    price_kzt: string;
  }>;
  if (usdRowsRaw.length === 0) return 0;
  // neon отдаёt DATE-колонку как объект Date, а не строку — явно приводим к
  // "YYYY-MM-DD", иначе сравнение ниже (Date <= string) тихо всегда ложно
  // (оба операнда приводятся к Number, а Number('2025-10-04') === NaN).
  const usdRows = usdRowsRaw.map((r) => ({
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date.toISOString().slice(0, 10),
    price_kzt: r.price_kzt,
  }));

  // CoinGecko иногда отдаёт две точки на одну календарную дату (например,
  // текущие неполные сутки) — unnest/ON CONFLICT в одной команде не терпит
  // дублей по (date,kind,code), поэтому схлопываем по дате, оставляя последнюю.
  const byDate = new Map<string, number>();
  for (const [ts, priceUsd] of body.prices) {
    byDate.set(new Date(ts).toISOString().slice(0, 10), priceUsd);
  }

  const dates: string[] = [];
  const prices: number[] = [];
  let usdIdx = 0;
  for (const [iso, priceUsd] of [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    while (usdIdx + 1 < usdRows.length && usdRows[usdIdx + 1].date <= iso) usdIdx++;
    const usdRate = Number(usdRows[usdIdx].price_kzt);
    if (!usdRate) continue;
    dates.push(iso);
    prices.push(priceUsd * usdRate);
  }
  if (dates.length === 0) return 0;

  const kinds = dates.map(() => 'crypto');
  const codes = dates.map(() => coinId);
  await sql`
    INSERT INTO rate_history (date, kind, code, price_kzt)
    SELECT * FROM unnest(${dates}::date[], ${kinds}::text[], ${codes}::text[], ${prices}::numeric[])
    AS t(date, kind, code, price_kzt)
    ON CONFLICT (date, kind, code) DO UPDATE SET price_kzt = excluded.price_kzt
  `;
  return dates.length;
}

export async function handleRatesBackfillAdmin(request: Request, env: RatesEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/admin/rates-backfill' || request.method !== 'POST') return null;
  const key = request.headers.get('X-Admin-Key') ?? '';
  if (!env.RATES_BACKFILL_KEY || !constantTimeEqual(key, env.RATES_BACKFILL_KEY)) {
    return json({ error: 'unauthorized' }, 401);
  }
  const sql = neon(env.DATABASE_URL);
  const body = (await request.json().catch(() => ({}))) as { action?: string; coinId?: string; batch?: number };
  try {
    if (body.action === 'crypto') {
      if (!body.coinId) return json({ error: 'missing coinId' }, 400);
      const inserted = await backfillCryptoHistory(sql, body.coinId);
      return json({ inserted });
    }
    const inserted = await backfillMissingDays(sql, body.batch ?? 30);
    return json({ inserted });
  } catch (e) {
    return errorJson(e, 500);
  }
}
