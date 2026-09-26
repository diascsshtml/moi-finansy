import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { BillRow } from '../components/BillRow';
import { EmptyState } from '../components/EmptyState';
import { getBillsGroupedByMonth } from '../utils/bills';
import { formatMonthYearFull } from '../utils/format';

export function Bills() {
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const navigate = useNavigate();

  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);

  const groups = useMemo(
    () => (bills && transactions ? getBillsGroupedByMonth(bills, transactions) : []),
    [bills, transactions],
  );

  if (!bills || !transactions) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-row">
          <h1>{t('bills.title')}</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/bills/new')}>
            {t('bills.addButton')}
          </button>
        </div>
        <p className="page-subtitle">{t('bills.subtitle')}</p>
      </header>

      {groups.length === 0 ? (
        <EmptyState icon="💳" title={t('bills.emptyTitle')} hint={t('bills.emptyHint')} />
      ) : (
        <div className="history-groups">
          {groups.map((group) => (
            <div key={group.monthKey} className="history-group">
              <h3 className="history-group-date">{formatMonthYearFull(group.monthDate)}</h3>
              <div className="debts-list">
                {group.statuses.map((s) => (
                  <BillRow key={s.bill.id} status={s} currency={settings.currency} isDark={isDark} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
