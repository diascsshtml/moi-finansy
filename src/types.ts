// Общие типы данных приложения.
// Всё хранится локально в IndexedDB (см. src/db/db.ts) — сервера нет.

export type TransactionType = 'income' | 'expense';

/** Денежный "карман" — например «Личное» и «Бизнес». У каждой операции есть
 *  свой счёт, поэтому всегда видно, откуда пришли и куда ушли именно эти деньги. */
export interface Account {
  id: string;
  name: string;
  icon: string; // emoji
  color: string; // hex
  order: number;
  isSystem?: boolean; // встроенный счёт (Личное/Бизнес) — можно переименовать, нельзя удалить, если он последний
  /** Ключ перевода для встроенных, ещё не переименованных пользователем счетов —
   *  тогда название следует за языком интерфейса. Как только пользователь
   *  меняет название сам, ключ убирается и текст остаётся его собственным. */
  nameKey?: string;
  /** Где физически лежат деньги — банк или «Наличные». Чисто информационная
   *  метка, свободный текст (пресет из чипов или свой вариант). */
  bank?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string; // emoji
  color: string; // hex, используется в графиках/значках
  isSystem?: boolean; // встроенная категория — нельзя удалить (напр. связанные с долгами)
  isDebtRelated?: boolean; // операции этой категории не учитываются в разбивке "куда трачу"
  order: number;
  /** См. Account.nameKey — то же самое для встроенных категорий по умолчанию. */
  nameKey?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // всегда положительное число
  categoryId: string;
  accountId: string; // какой счёт затронут (Личное/Бизнес/…)
  date: string; // ISO-дата yyyy-MM-dd
  note?: string;
  /** Контрагент — кто конкретно заплатил или кому заплатили, отдельно от
   *  заметки (например имя клиента при доходе или поставщика при расходе). */
  counterparty?: string;
  createdAt: string; // ISO datetime, для сортировки внутри дня
  debtId?: string; // если операция создана автоматически из долга
  debtPaymentId?: string; // если это платёж по долгу
  billId?: string; // если это оплата регулярного платежа (кредит, подписка, тариф)
}

/** Перемещение денег между своими же счетами — не доход и не расход,
 *  общий капитал не меняется, меняется только то, в каком кармане деньги лежат. */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

export type DebtDirection = 'owed_to_me' | 'i_owe';
export type DebtStatus = 'open' | 'closed';

export interface Person {
  id: string;
  name: string;
  note?: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  personId: string;
  direction: DebtDirection;
  initialAmount: number;
  currentAmount: number; // остаток долга
  date: string; // дата возникновения
  dueDate?: string;
  note?: string;
  status: DebtStatus;
  createdAt: string;
  closedAt?: string;
  writtenOff?: boolean; // остаток был списан (прощён), а не выплачен
  writtenOffAmount?: number; // сколько было списано (зафиксировано на момент списания)
  linkedToBalance: boolean; // учитывать ли движение денег в общем балансе
  accountId: string; // из/в какого счёта фактически ушли/пришли деньги
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

/** Обязательный ежемесячный платёж — кредит, тариф, подписка и т.п.
 *  Это шаблон повторения; факт оплаты за конкретный месяц — обычная
 *  Transaction с ссылкой billId, как и у долгов. */
export interface RecurringBill {
  id: string;
  name: string;
  amount: number; // ожидаемая сумма платежа
  dayOfMonth: number; // 1–31, день оплаты; в коротких месяцах берётся последний день
  /** Дата, выбранная при создании платежа (yyyy-MM-dd) — определяет месяц
   *  ПЕРВОГО цикла: пока естественный расчёт по сегодняшней дате не дойдёт
   *  до её месяца, показывается именно она. У платежей, созданных до
   *  введения этого поля, его нет — для них работает прежняя логика
   *  (откат на месяц вперёд, если день уже прошёл на момент создания). */
  firstDueDate?: string;
  categoryId: string;
  accountId: string;
  icon: string;
  color: string;
  reminderDaysBefore: number; // за сколько дней до срока начинать напоминать
  isActive: boolean; // приостановленный платёж не показывается как просроченный/скоро
  /** Системные уведомления браузера конкретно по этому платежу — отдельно от
   *  reminderDaysBefore (тот задаёт срок, этот — включены ли уведомления
   *  вообще). У платежей, созданных до этого поля, undefined — считаем как
   *  включено (см. notifyAboutBills). На баннер/бейдж «скоро/просрочено» в
   *  самом приложении не влияет — только на браузерное уведомление. */
  notifyEnabled?: boolean;
  note?: string;
  createdAt: string;
}

/** Заготовка из каталога поставщиков — просто предзаполняет форму нового
 *  платежа (название/иконка/цвет/категория), пользователь всё равно вводит
 *  сумму и день оплаты сам. */
export interface BillPreset {
  name: string;
  icon: string;
  color: string;
  categoryNameKey: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'ru' | 'kk';

export interface AppSettings {
  id: 'app';
  currency: string; // символ валюты, напр. "₸"
  theme: ThemeMode;
  language: AppLanguage;
  // Экран блокировки — не шифрование, только гейт перед интерфейсом.
  // Хранится соль+хэш (SHA-256), сам PIN нигде не сохраняется в открытом виде.
  pinHash?: string;
  pinSalt?: string;
  pinLength?: number;
  onboarded: boolean;
}

// Единая запись для ленты истории операций
export type HistoryEntryKind =
  | 'income'
  | 'expense'
  | 'debt_created'
  | 'debt_payment'
  | 'debt_written_off'
  | 'transfer';

export interface HistoryEntry {
  id: string;
  kind: HistoryEntryKind;
  date: string;
  createdAt: string;
  amount: number;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  accountId?: string;
  transaction?: Transaction;
  debt?: Debt;
  debtPayment?: DebtPayment;
  person?: Person;
  transfer?: Transfer;
}
