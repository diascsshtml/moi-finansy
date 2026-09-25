import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { BillStatus } from '../utils/bills';

interface BillsAlertBannerProps {
  statuses: BillStatus[];
}

/** Заметный баннер на главном экране — работает всегда, независимо от
 *  разрешений на уведомления в браузере. */
export function BillsAlertBanner({ statuses }: BillsAlertBannerProps) {
  const { t } = useTranslation();
  if (statuses.length === 0) return null;

  const hasOverdue = statuses.some((s) => s.status === 'overdue');

  return (
    <Link to="/bills" className={`bills-banner${hasOverdue ? ' bills-banner--overdue' : ''}`}>
      <span className="bills-banner-icon" aria-hidden="true">
        {hasOverdue ? '⚠️' : '💳'}
      </span>
      <span className="bills-banner-text">{t('bills.bannerTitle', { count: statuses.length })}</span>
      <span className="bills-banner-cta">{t('bills.bannerCta')} →</span>
    </Link>
  );
}
