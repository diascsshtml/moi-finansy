import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dateToISO, formatDateShort, formatMoney } from '../utils/format';
import { toDisplayColor } from '../styles/palette';
import { isMonogramIcon } from '../data/billCatalog';
import { getDueRelativeLabel, type BillStatus } from '../utils/bills';

interface BillRowProps {
  status: BillStatus;
  currency: string;
  isDark: boolean;
}

export function BillRow({ status, currency, isDark }: BillRowProps) {
  const { t } = useTranslation();
  const { bill } = status;

  let badgeText: string;
  let badgeClass = 'debt-badge';
  if (status.status === 'paid') {
    badgeText = t('bills.paidBadge');
    badgeClass += ' debt-badge--paid';
  } else if (status.status === 'paused') {
    badgeText = t('bills.pausedBadge');
  } else {
    const dueDateText = formatDateShort(dateToISO(status.dueDate));
    badgeText = `${dueDateText} · ${getDueRelativeLabel(status, t)}`;
    if (status.status === 'overdue' || status.daysUntilDue === 0) badgeClass += ' debt-badge--overdue';
  }

  const color = toDisplayColor(bill.color, isDark);
  const inactive = status.status === 'paid' || status.status === 'paused';
  const isUnpaidActive = status.status === 'overdue' || status.status === 'due_soon' || status.status === 'upcoming';

  return (
    <Link to={`/bills/${bill.id}`} className={`bill-row${inactive ? ' debt-row--closed' : ''}`}>
      <span className="bill-row-icon-wrap">
        <span
          className={`history-row-icon${isMonogramIcon(bill.icon) ? ' icon-monogram' : ''}`}
          style={{ background: `${color}26`, color }}
          aria-hidden="true"
        >
          {bill.icon}
        </span>
        {status.status === 'paid' && (
          <span className="bill-row-status-badge bill-row-status-badge--paid" aria-hidden="true">
            ✓
          </span>
        )}
        {isUnpaidActive && (
          <span className="bill-row-status-badge bill-row-status-badge--unpaid" aria-hidden="true">
            !
          </span>
        )}
      </span>
      <span className="bill-row-body">
        <span className="debt-row-top">
          <span className="debt-row-name">{bill.name}</span>
          <span className="debt-row-amount">{formatMoney(bill.amount, currency)}</span>
        </span>
        <span className={badgeClass}>{badgeText}</span>
      </span>
    </Link>
  );
}
