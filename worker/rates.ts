// Курсы валют — официальный бесплатный XML-фид Нацбанка РК, без ключа.
// Воркер здесь нужен только как прокси: сам NBRK не шлёт CORS-заголовки,
// поэтому напрямую из браузера эти данные не получить. Ответ кэшируем на
// час (курсы обновляются раз в сутки) — see Cache-Control ниже.

export interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
  quant: number;
  change: number;
}

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

export async function handleRatesApi(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/rates' || request.method !== 'GET') return null;

  const fdate = formatDateForNbrk(new Date());
  try {
    const res = await fetch(`https://nationalbank.kz/rss/get_rates.cfm?fdate=${fdate}`);
    if (!res.ok) throw new Error(`NBRK вернул ${res.status}`);
    const xml = await res.text();
    const rates = parseRatesXml(xml);
    return new Response(JSON.stringify({ date: fdate, rates }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
