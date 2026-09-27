import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { BillStatus, CreditProgress } from '../utils/bills';
import { dateToISO, formatDateHuman, formatMoney } from '../utils/format';
import { useSheet } from '../context/SheetContext';

interface CreditRowProps {
  status: BillStatus;
  progress: CreditProgress;
  currency: string;
}

/** Карточка кредита/рассрочки на странице «Кредиты и подписки» — по образцу
 *  DebtRow (плашка суммы, быстрая отметка оплаты, полоса прогресса), плюс
 *  специфика кредита: ставка и дата+сумма следующего платежа отдельной
 *  строкой снизу. Подписки показываются попроще, через BillRow. */
export function CreditRow({ status, progress, currency }: CreditRowProps) {
  const { t } = useTranslation();
  const { open } = useSheet();
  const { bill, dueDate } = status;
  const dueDateISO = dateToISO(dueDate);

  return (
    <Link to={`/bills/${bill.id}`} className={`debt-row${status.status === 'paused' ? ' debt-row--closed' : ''}`}>
      <div className="debt-row-top">
        <span className="debt-row-name">{bill.name}</span>
        <span className="debt-row-actions">
          <span className="debt-row-amount-pill tone-negative">
            {formatMoney(progress.totalAmount > 0 ? progress.remaining : bill.amount, currency)}
          </span>
          {status.status !== 'paused' && (
            <span
              role="button"
              tabIndex={0}
              className="debt-row-quick-add"
              aria-label={t('bills.markPaidButton')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                open({ kind: 'credit-payment', bill });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  open({ kind: 'credit-payment', bill });
                }
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
            </span>
          )}
        </span>
      </div>

      <div className="debt-row-subtitle">
        {bill.interestRate ? `${bill.interestRate.toFixed(1)}% · ` : ''}
        {t('bills.paymentOn', { date: formatDateHuman(dueDateISO) })}
      </div>

      {progress.totalAmount > 0 && (
        <>
          <div className="debt-progress-track">
            <div className="debt-progress-fill" style={{ width: `${progress.progressPct}%`, background: 'var(--danger)' }} />
          </div>
          <div className="debt-row-progress-summary">
            <span>{t('debtDetail.progressRemaining', { amount: formatMoney(progress.remaining, currency) })}</span>
            <span>{t('debtDetail.progressPaidPct', { pct: progress.progressPct })}</span>
          </div>
        </>
      )}

      <div className="debt-detail-divider" />

      <div className="credit-row-footer">
        <span className="credit-row-footer-date">{formatDateHuman(dueDateISO)}</span>
        <span className="credit-row-footer-next">
          {t('bills.nextPaymentLabel')} · {formatMoney(bill.amount, currency)}
        </span>
      </div>
    </Link>
  );
}
