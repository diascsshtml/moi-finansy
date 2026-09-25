// Фиксированные идентификаторы системных категорий, связанных с долгами.
// Нужны как константы, чтобы код долгов мог находить/создавать операции
// без поиска категории по имени.
export const SYSTEM_CATEGORY_IDS = {
  debtGivenOut: 'sys-debt-given-out', // расход: выдал долг (одолжил кому-то)
  debtReceived: 'sys-debt-received', // доход: получил долг (занял у кого-то)
  debtRepaymentIn: 'sys-debt-repayment-in', // доход: мне вернули долг
  debtRepaymentOut: 'sys-debt-repayment-out', // расход: я погасил свой долг
  otherIncome: 'sys-other-income',
  otherExpense: 'sys-other-expense',
} as const;

export const SETTINGS_ID = 'app' as const;

// Счета по умолчанию — личные деньги и деньги бизнеса.
export const SYSTEM_ACCOUNT_IDS = {
  personal: 'acc-personal',
  business: 'acc-business',
} as const;
