import { db } from './db';
import { SETTINGS_ID, SYSTEM_ACCOUNT_IDS, SYSTEM_CATEGORY_IDS } from './constants';
import type { Account, AppLanguage, Category } from '../types';
import { CATEGORICAL_LIGHT, NEUTRAL_COLOR, paletteColorForOrder } from '../styles/palette';

const EXPENSE_DEFAULTS: Array<Pick<Category, 'name' | 'icon' | 'nameKey'>> = [
  { name: 'Продукты', icon: '🛒', nameKey: 'categoryNames.groceries' },
  { name: 'Транспорт', icon: '🚌', nameKey: 'categoryNames.transport' },
  { name: 'Жильё и коммуналка', icon: '🏠', nameKey: 'categoryNames.housing' },
  { name: 'Кафе и рестораны', icon: '☕', nameKey: 'categoryNames.cafe' },
  { name: 'Здоровье', icon: '💊', nameKey: 'categoryNames.health' },
  { name: 'Одежда', icon: '👕', nameKey: 'categoryNames.clothing' },
  { name: 'Развлечения', icon: '🎮', nameKey: 'categoryNames.entertainment' },
  { name: 'Связь и интернет', icon: '📱', nameKey: 'categoryNames.communication' },
  { name: 'Образование', icon: '📚', nameKey: 'categoryNames.education' },
  { name: 'Подарки', icon: '🎁', nameKey: 'categoryNames.giftsExpense' },
  { name: 'Кредиты и платежи', icon: '💳', nameKey: 'categoryNames.loanPayments' },
];

const INCOME_DEFAULTS: Array<Pick<Category, 'name' | 'icon' | 'nameKey'>> = [
  { name: 'Зарплата', icon: '💼', nameKey: 'categoryNames.salary' },
  { name: 'Подработка', icon: '💻', nameKey: 'categoryNames.freelance' },
  { name: 'Подарки', icon: '🎁', nameKey: 'categoryNames.giftsIncome' },
  { name: 'Инвестиции', icon: '📈', nameKey: 'categoryNames.investments' },
];

function detectInitialLanguage(): AppLanguage {
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('kk')) return 'kk';
  return 'ru';
}

export async function ensureSeeded(): Promise<void> {
  const settings = await db.settings.get(SETTINGS_ID);
  if (!settings) {
    await db.settings.put({
      id: SETTINGS_ID,
      currency: '₸',
      theme: 'system',
      language: detectInitialLanguage(),
      onboarded: false,
    });
  } else if (!settings.language) {
    // Апгрейд с версии без выбора языка — по умолчанию русский, ничего не ломаем.
    await db.settings.update(SETTINGS_ID, { language: 'ru' });
  }

  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    const accounts: Account[] = [
      {
        id: SYSTEM_ACCOUNT_IDS.personal,
        name: 'Личное',
        nameKey: 'accountNames.personal',
        icon: '👤',
        color: CATEGORICAL_LIGHT[0],
        order: 0,
        isSystem: true,
      },
      {
        id: SYSTEM_ACCOUNT_IDS.business,
        name: 'Бизнес',
        nameKey: 'accountNames.business',
        icon: '💼',
        color: CATEGORICAL_LIGHT[6],
        order: 1,
        isSystem: true,
      },
    ];
    await db.accounts.bulkAdd(accounts);
  }

  const categoryCount = await db.categories.count();
  if (categoryCount > 0) return;

  const categories: Category[] = [];
  let order = 0;

  for (const c of EXPENSE_DEFAULTS) {
    categories.push({
      id: `exp-${order}`,
      name: c.name,
      nameKey: c.nameKey,
      icon: c.icon,
      type: 'expense',
      color: paletteColorForOrder(order),
      order,
    });
    order++;
  }
  order = 0;
  for (const c of INCOME_DEFAULTS) {
    categories.push({
      id: `inc-${order}`,
      name: c.name,
      nameKey: c.nameKey,
      icon: c.icon,
      type: 'income',
      color: paletteColorForOrder(order),
      order,
    });
    order++;
  }

  // Системные категории — не удаляются пользователем.
  categories.push(
    {
      id: SYSTEM_CATEGORY_IDS.otherExpense,
      name: 'Прочее',
      nameKey: 'categoryNames.otherExpense',
      icon: '📦',
      type: 'expense',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      order: 900,
    },
    {
      id: SYSTEM_CATEGORY_IDS.otherIncome,
      name: 'Прочее',
      nameKey: 'categoryNames.otherIncome',
      icon: '📦',
      type: 'income',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      order: 900,
    },
    {
      id: SYSTEM_CATEGORY_IDS.debtGivenOut,
      name: 'Выдача долга',
      nameKey: 'categoryNames.debtGivenOut',
      icon: '🤝',
      type: 'expense',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      isDebtRelated: true,
      order: 901,
    },
    {
      id: SYSTEM_CATEGORY_IDS.debtReceived,
      name: 'Получение долга',
      nameKey: 'categoryNames.debtReceived',
      icon: '🤝',
      type: 'income',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      isDebtRelated: true,
      order: 901,
    },
    {
      id: SYSTEM_CATEGORY_IDS.debtRepaymentIn,
      name: 'Возврат долга мне',
      nameKey: 'categoryNames.debtRepaymentIn',
      icon: '💳',
      type: 'income',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      isDebtRelated: true,
      order: 902,
    },
    {
      id: SYSTEM_CATEGORY_IDS.debtRepaymentOut,
      name: 'Погашение моего долга',
      nameKey: 'categoryNames.debtRepaymentOut',
      icon: '💳',
      type: 'expense',
      color: NEUTRAL_COLOR.light,
      isSystem: true,
      isDebtRelated: true,
      order: 902,
    },
  );

  await db.categories.bulkAdd(categories);
}
