import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { BillRow } from '../components/BillRow';
import { CreditRow } from '../components/CreditRow';
import { EmptyState } from '../components/EmptyState';
import { getAllBillStatuses, getCreditProgress, resolveBillKind } from '../utils/bills';

export function Bills() {
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const navigate = useNavigate();

  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const { credits, subscriptions } = useMemo(() => {
    if (!bills || !transactions) return { credits: [], subscriptions: [] };
    const statuses = getAllBillStatuses(bills, transactions);
    const credits = statuses.filter((s) => resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId)) === 'credit');
    const subscriptions = statuses.filter((s) => resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId)) === 'subscription');
    return { credits, subscriptions };
  }, [bills, transactions, categoriesById]);

  if (!bills || !transactions || !categories) return null;

  const isEmpty = credits.length === 0 && subscriptions.length === 0;

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

      {isEmpty ? (
        <EmptyState icon="💳" title={t('bills.emptyTitle')} hint={t('bills.emptyHint')} />
      ) : (
        <>
          <section className="recent-section">
            <div className="section-header">
              <h2>{t('bills.sectionCredits')}</h2>
              <button type="button" className="btn-link" onClick={() => navigate('/bills/new')}>
                {t('bills.addCreditLink')}
              </button>
            </div>
            {credits.length === 0 ? (
              <p className="settings-hint">{t('bills.emptyCreditsHint')}</p>
            ) : (
              <div className="debts-list">
                {credits.map((s) => (
                  <CreditRow key={s.bill.id} status={s} progress={getCreditProgress(s.bill, transactions!)} currency={settings.currency} />
                ))}
              </div>
            )}
          </section>

          <section className="recent-section">
            <div className="section-header">
              <h2>{t('bills.sectionSubscriptions')}</h2>
              <button type="button" className="btn-link" onClick={() => navigate('/bills/new')}>
                {t('bills.addSubscriptionLink')}
              </button>
            </div>
            {subscriptions.length === 0 ? (
              <p className="settings-hint">{t('bills.emptySubscriptionsHint')}</p>
            ) : (
              <div className="debts-list">
                {subscriptions.map((s) => (
                  <BillRow key={s.bill.id} status={s} currency={settings.currency} isDark={isDark} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
