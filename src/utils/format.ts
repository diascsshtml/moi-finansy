import { format, isThisYear, isToday, isYesterday, parseISO } from 'date-fns';
import { kk, ru } from 'date-fns/locale';
import i18n from '../i18n';

function dateFnsLocale() {
  return i18n.language === 'kk' ? kk : ru;
}

function intlLocale() {
  return i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU';
}

/** Форматирует сумму с разделителями разрядов и символом валюты. Никогда не
 *  используется tabular-nums на крупных отдельных числах (только в таблицах/колонках). */
export function formatMoney(amount: number, currency: string, opts?: { signed?: boolean }): string {
  const rounded = Math.round(amount * 100) / 100;
  const abs = Math.abs(rounded);
  const body = new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const sign = opts?.signed ? (rounded > 0 ? '+ ' : rounded < 0 ? '− ' : '') : rounded < 0 ? '− ' : '';
  return `${sign}${body} ${currency}`;
}

/** Компактный формат для мелких мест интерфейса (легенды графиков): 12.9K и т.п. */
export function formatCompact(amount: number): string {
  return new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
}

export function formatDateHuman(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return i18n.t('history.today');
  if (isYesterday(d)) return i18n.t('history.yesterday');
  return format(d, isThisYear(d) ? 'd MMMM' : 'd MMMM yyyy', { locale: dateFnsLocale() });
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: dateFnsLocale() });
}

export function formatMonthLabel(iso: string): string {
  return format(parseISO(iso), 'LLL yyyy', { locale: dateFnsLocale() });
}

/** Полное название месяца + год из объекта Date — заголовок группы месяца
 *  (напр. в списке регулярных платежей). */
export function formatMonthYearFull(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: dateFnsLocale() });
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** ISO-дата (yyyy-MM-dd) из объекта Date по локальному времени. Специально
 *  не через date.toISOString() — тот переводит в UTC и при часовом поясе
 *  впереди UTC (напр. Казахстан) может сдвинуть дату на день назад. */
export function dateToISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function nowISO(): string {
  return new Date().toISOString();
}
