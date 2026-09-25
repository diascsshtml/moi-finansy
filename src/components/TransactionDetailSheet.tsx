import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { useSheet } from '../context/SheetContext';
import { db } from '../db/db';
import { formatDateShort, formatMoney } from '../utils/format';
import { categoryDisplayName, accountDisplayName } from '../utils/displayName';
import { useSettings } from '../context/SettingsContext';
import type { Transaction } from '../types';

interface TransactionDetailSheetProps {
  onClose: () => void;
  transaction: Transaction;
}

/** Просмотр операции: сначала только данные, без риска что-то случайно
 *  задеть — изменение/удаление доступно отдельным шагом через «Редактировать». */
export function TransactionDetailSheet({ onClose, transaction }: TransactionDetailSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { open } = useSheet();

  const category = useLiveQuery(() => db.categories.get(transaction.categoryId), [transaction.categoryId]);
  const account = useLiveQuery(() => db.accounts.get(transaction.accountId), [transaction.accountId]);

  const isIncome = transaction.type === 'income';
  const amountText = `${isIncome ? '+' : '−'} ${formatMoney(transaction.amount, settings.currency)}`;

  return (
    <Sheet
      title={t('transaction.detailTitle')}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => open({ kind: 'edit-transaction', transaction })}
        >
          {t('common.edit')}
        </button>
      }
    >
      <div className="debt-detail-card">
        <span className="debt-detail-badge">{isIncome ? t('transaction.income') : t('transaction.expense')}</span>
        <div className={`debt-detail-amount tone-${isIncome ? 'positive' : 'negative'}`}>{amountText}</div>

        <dl className="debt-detail-meta">
          <div>
            <dt>{t('common.date')}</dt>
            <dd>{formatDateShort(transaction.date)}</dd>
          </div>
          <div>
            <dt>{t('transaction.account')}</dt>
            <dd>{accountDisplayName(account, t)}</dd>
          </div>
          <div>
            <dt>{t('transaction.category')}</dt>
            <dd>{categoryDisplayName(category, t)}</dd>
          </div>
          {transaction.counterparty && (
            <div>
              <dt>{isIncome ? t('transaction.counterpartyLabelIncome') : t('transaction.counterpartyLabelExpense')}</dt>
              <dd>{transaction.counterparty}</dd>
            </div>
          )}
          {transaction.note && (
            <div>
              <dt>{t('common.note')}</dt>
              <dd>{transaction.note}</dd>
            </div>
          )}
        </dl>
      </div>
    </Sheet>
  );
}
