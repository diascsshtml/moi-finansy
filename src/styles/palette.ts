// Валидированная палитра (см. dataviz skill, references/palette.md).
// Категориальные оттенки идут в фиксированном порядке — их нельзя переставлять
// или "зацикливать": так каждая категория всегда получает один и тот же цвет.

export const CATEGORICAL_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

// Доходы/расходы как два "полюса" денежного потока — синий/красный (slot 1 / slot 8),
// прошли проверку validate_palette.js (CVD ΔE 21.6 light / 19.2 dark, contrast >= 3:1).
export const INCOME_COLOR = { light: CATEGORICAL_LIGHT[0], dark: CATEGORICAL_DARK[0] };
export const EXPENSE_COLOR = { light: CATEGORICAL_LIGHT[7], dark: CATEGORICAL_DARK[7] };

// Нейтральный серый для "Другое" и системных категорий без выделенного оттенка —
// не является частью категориальной последовательности, поэтому не участвует
// в проверках различимости между сериями.
export const NEUTRAL_COLOR = { light: '#898781', dark: '#898781' };

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export const CHROME = {
  light: {
    surface: '#fcfcfb',
    page: '#f9f9f7',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    textMuted: '#898781',
    grid: '#e1e0d9',
    baseline: '#c3c2b7',
    moneyPositive: '#006300',
    moneyNegative: '#b23327',
    border: 'rgba(11,11,11,0.10)',
  },
  dark: {
    surface: '#1a1a19',
    page: '#0d0d0d',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    textMuted: '#898781',
    grid: '#2c2c2a',
    baseline: '#383835',
    moneyPositive: '#0ca30c',
    moneyNegative: '#e66767',
    border: 'rgba(255,255,255,0.10)',
  },
} as const;

/** Присваивает цвет категории по её стабильному порядковому номеру (order),
 *  циклически проходя по 8 категориальным оттенкам. Используется только при
 *  создании категории — цвет затем хранится в записи и не пересчитывается. */
export function paletteColorForOrder(order: number, mode: 'light' | 'dark' = 'light'): string {
  const arr = mode === 'light' ? CATEGORICAL_LIGHT : CATEGORICAL_DARK;
  return arr[order % arr.length];
}

const LIGHT_TO_DARK = new Map<string, string>(
  CATEGORICAL_LIGHT.map((hex, i) => [hex, CATEGORICAL_DARK[i]]),
);

/** Категории хранят "светлый" hex как стабильный идентификатор оттенка;
 *  для тёмной темы подставляем соответствующий шаг того же слота. */
export function toDisplayColor(storedColor: string, isDark: boolean): string {
  if (!isDark) return storedColor;
  return LIGHT_TO_DARK.get(storedColor) ?? storedColor;
}

export function getPalette(isDark: boolean) {
  return {
    categorical: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    income: isDark ? INCOME_COLOR.dark : INCOME_COLOR.light,
    expense: isDark ? EXPENSE_COLOR.dark : EXPENSE_COLOR.light,
    neutral: isDark ? NEUTRAL_COLOR.dark : NEUTRAL_COLOR.light,
    chrome: isDark ? CHROME.dark : CHROME.light,
  };
}
