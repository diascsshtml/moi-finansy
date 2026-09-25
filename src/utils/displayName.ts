import type { TFunction } from 'i18next';
import type { Account, Category } from '../types';

/** Отображаемое имя категории: встроенные (ещё не переименованные пользователем)
 *  следуют за языком интерфейса через nameKey, пользовательские — всегда
 *  показывают ровно тот текст, что ввёл человек. */
export function categoryDisplayName(category: Category | undefined, t: TFunction): string {
  if (!category) return '';
  return category.nameKey ? t(category.nameKey) : category.name;
}

export function accountDisplayName(account: Account | undefined, t: TFunction): string {
  if (!account) return '';
  return account.nameKey ? t(account.nameKey) : account.name;
}
