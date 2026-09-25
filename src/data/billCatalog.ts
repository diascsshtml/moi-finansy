import { CATEGORICAL_LIGHT } from '../styles/palette';

export interface BillCatalogItem {
  id: string;
  /** Эмодзи-пиктограмма для общих категорий (коммуналка, страховка) или
   *  1-3-буквенная монограмма для конкретных брендов — раскрашивается в
   *  цвет, близкий к их фирменному. Настоящих логотипов-изображений тут
   *  нет: их негде легально и офлайн взять для большинства локальных
   *  компаний, поэтому монограмма — честная замена «стикеру». */
  icon: string;
  color: string;
  categoryNameKey: string;
}

export interface BillCatalogGroup {
  key: string;
  items: BillCatalogItem[];
}

const MONOGRAM_RE = /^[A-Za-zА-Яа-яЁё+]{1,3}$/;

/** Отличает буквенную монограмму (T2, Kp, iD...) от обычной эмодзи-иконки —
 *  чтобы применить более жирное и компактное начертание именно к тексту. */
export function isMonogramIcon(icon: string): boolean {
  return MONOGRAM_RE.test(icon);
}

const c = CATEGORICAL_LIGHT;
const COMM = 'categoryNames.communication';
const HOUSING = 'categoryNames.housing';
const LOANS = 'categoryNames.loanPayments';
const ENTERTAINMENT = 'categoryNames.entertainment';
const OTHER = 'categoryNames.otherExpense';

export const BILL_CATALOG: BillCatalogGroup[] = [
  {
    key: 'mobile',
    items: [
      { id: 'tele2', icon: 'T2', color: '#E3344B', categoryNameKey: COMM },
      { id: 'kcell', icon: 'Kc', color: '#F7941D', categoryNameKey: COMM },
      { id: 'beeline', icon: 'Bl', color: '#D4A017', categoryNameKey: COMM },
      { id: 'activ', icon: 'Ac', color: '#2E9E44', categoryNameKey: COMM },
      { id: 'altel', icon: 'Al', color: '#2979FF', categoryNameKey: COMM },
    ],
  },
  {
    key: 'internet',
    items: [
      { id: 'megaline', icon: 'Mg', color: '#9C27B0', categoryNameKey: COMM },
      { id: 'telecom', icon: 'KT', color: '#00ACC1', categoryNameKey: COMM },
      { id: 'idtv', icon: 'iD', color: '#EC407A', categoryNameKey: COMM },
      { id: 'almatv', icon: 'AV', color: '#5C6BC0', categoryNameKey: COMM },
    ],
  },
  {
    key: 'utilities',
    items: [
      { id: 'electricity', icon: '💡', color: c[1], categoryNameKey: HOUSING },
      { id: 'water', icon: '🚰', color: c[2], categoryNameKey: HOUSING },
      { id: 'gas', icon: '🔥', color: c[3], categoryNameKey: HOUSING },
      { id: 'heating', icon: '♨️', color: c[4], categoryNameKey: HOUSING },
      { id: 'garbage', icon: '🗑️', color: c[5], categoryNameKey: HOUSING },
      { id: 'ksk', icon: '🏢', color: c[6], categoryNameKey: HOUSING },
      { id: 'rent', icon: '🏠', color: c[7], categoryNameKey: HOUSING },
    ],
  },
  {
    key: 'loans',
    items: [
      { id: 'kaspiCredit', icon: 'Kp', color: '#F03E3E', categoryNameKey: LOANS },
      { id: 'halykLoan', icon: 'Hl', color: '#0CA678', categoryNameKey: LOANS },
      { id: 'freedomLoan', icon: 'Fr', color: '#3B82F6', categoryNameKey: LOANS },
      { id: 'jusanLoan', icon: 'Js', color: '#9333EA', categoryNameKey: LOANS },
      { id: 'berekeLoan', icon: 'Br', color: '#14B8A6', categoryNameKey: LOANS },
    ],
  },
  {
    key: 'subscriptions',
    items: [
      { id: 'netflix', icon: 'N', color: '#E50914', categoryNameKey: ENTERTAINMENT },
      { id: 'spotify', icon: 'S', color: '#1DB954', categoryNameKey: ENTERTAINMENT },
      { id: 'youtubePremium', icon: 'YT', color: '#FF0000', categoryNameKey: ENTERTAINMENT },
      { id: 'icloud', icon: 'iC', color: '#3693F3', categoryNameKey: ENTERTAINMENT },
      { id: 'yandexPlus', icon: 'Я+', color: '#E8B923', categoryNameKey: ENTERTAINMENT },
      { id: 'gym', icon: '🏋️', color: c[2], categoryNameKey: ENTERTAINMENT },
    ],
  },
  {
    key: 'insurance',
    items: [
      { id: 'osago', icon: '🚗', color: c[3], categoryNameKey: OTHER },
      { id: 'lifeInsurance', icon: '🛡️', color: c[4], categoryNameKey: OTHER },
    ],
  },
];
