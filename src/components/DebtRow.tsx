import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Account, Debt, Person } from '../types';
import { formatMoney, formatDateShort, todayISO } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';

interface DebtRowProps {
  debt: Debt;
  person?: Person;
  currency: string;
  account?: Account;
}

export function DebtRow({ debt, person, currency, account }: DebtRowProps) {
  const { t } = useTranslation();
  const progress = debt.initialAmount > 0 ? 1 - debt.currentAmount / debt.initialAmount : 0;
  const isOverdue = debt.status === 'open' && !!debt.dueDate && debt.dueDate < todayISO();

  return (
    <Link to={`/debts/${debt.id}`} className={`debt-row${debt.status === 'closed' ? ' debt-row--closed' : ''}`}>
      <div className="debt-row-top">
        <span className="debt-row-name">{person?.name ?? '—'}</span>
        <span className="debt-row-amount">{formatMoney(debt.currentAmount, currency)}</span>
      </div>
      {debt.status === 'open' && debt.currentAmount !== debt.initialAmount && (
        <div className="debt-progress-track">
          <div className="debt-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="debt-row-bottom">
        {debt.status === 'closed' ? (
          <span className="debt-badge debt-badge--closed">
            {debt.writtenOff ? t('debts.badgeWrittenOff') : t('debts.badgeClosed')}
          </span>
        ) : debt.dueDate ? (
          <span className={`debt-badge${isOverdue ? ' debt-badge--overdue' : ''}`}>
            {isOverdue ? t('debts.badgeOverduePrefix') : t('debts.badgeDuePrefix')}
            {formatDateShort(debt.dueDate)}
          </span>
        ) : (
          <span className="debt-badge">{t('debts.badgeNoDueDate')}</span>
        )}
        {account && (
          <span className="account-badge">
            <span aria-hidden="true">{account.icon}</span> {accountDisplayName(account, t)}
          </span>
        )}
        {debt.note && <span className="debt-row-note">{debt.note}</span>}
      </div>
    </Link>
  );
}
