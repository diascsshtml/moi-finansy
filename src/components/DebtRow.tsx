import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { differenceInCalendarMonths, parseISO } from 'date-fns';
import type { Account, Debt, Person } from '../types';
import { formatMoney, formatDateHuman, todayISO } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import { useSheet } from '../context/SheetContext';

interface DebtRowProps {
  debt: Debt;
  person?: Person;
  currency: string;
  account?: Account;
}

export function DebtRow({ debt, person, currency, account }: DebtRowProps) {
  const { t } = useTranslation();
  const { open } = useSheet();
  const progress = debt.initialAmount > 0 ? 1 - debt.currentAmount / debt.initialAmount : 0;
  const progressPct = Math.round(progress * 100);
  const isOverdue = debt.status === 'open' && !!debt.dueDate && debt.dueDate < todayISO();

  let subtitle: string;
  if (debt.status === 'closed') {
    subtitle = debt.writtenOff ? t('debts.badgeWrittenOff') : t('debts.badgeClosed');
  } else if (debt.dueDate) {
    const dueText = t('debts.dueOn', { date: formatDateHuman(debt.dueDate) });
    if (isOverdue) {
      subtitle = `${t('debts.badgeOverduePrefix')}${dueText}`;
    } else {
      const months = differenceInCalendarMonths(parseISO(debt.dueDate), new Date());
      subtitle = months > 0 ? `${t('debts.monthsLeft', { count: months })} · ${dueText}` : dueText;
    }
  } else {
    subtitle = t('debts.badgeNoDueDate');
  }

  return (
    <Link to={`/debts/${debt.id}`} className={`debt-row${debt.status === 'closed' ? ' debt-row--closed' : ''}`}>
      <div className="debt-row-top">
        <span className="debt-row-name">{person?.name ?? '—'}</span>
        <span className="debt-row-actions">
          <span className="debt-row-amount-pill">{formatMoney(debt.currentAmount, currency)}</span>
          {debt.status === 'open' && (
            <span
              role="button"
              tabIndex={0}
              className="debt-row-quick-add"
              aria-label={t('debtDetail.recordPayment')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                open({ kind: 'add-payment', debt });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  open({ kind: 'add-payment', debt });
                }
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
            </span>
          )}
        </span>
      </div>

      <div className="debt-row-subtitle">{subtitle}</div>

      {debt.status === 'open' && (
        <>
          <div className="debt-progress-track">
            <div className="debt-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="debt-row-progress-summary">
            <span>{t('debtDetail.progressRemaining', { amount: formatMoney(debt.currentAmount, currency) })}</span>
            <span>{t('debtDetail.progressPaidPct', { pct: progressPct })}</span>
          </div>
        </>
      )}

      {(account || debt.note) && (
        <div className="debt-row-bottom">
          {account && (
            <span className="account-badge">
              <EmojiIcon icon={account.icon} size={14} className="inline-icon" /> {accountDisplayName(account, t)}
            </span>
          )}
          {debt.note && <span className="debt-row-note">{debt.note}</span>}
        </div>
      )}
    </Link>
  );
}
