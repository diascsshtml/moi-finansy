import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { CreditRow } from '../components/CreditRow';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../utils/format';
import { getAllBillStatuses, getCreditProgress, isLoanKind, resolveBillKind } from '../utils/bills';

export function Bills() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const { credits, subscriptions } = useMemo(() => {
    if (!bills || !transactions) return { credits: [], subscriptions: [] };
    const statuses = getAllBillStatuses(bills, transactions);
    const credits = statuses.filter((s) => isLoanKind(resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId))));
    const subscriptions = statuses.filter((s) => resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId)) === 'subscription');
    return { credits, subscriptions };
  }, [bills, transactions, categoriesById]);

  if (!bills || !transactions || !categories) return null;

  const subscriptionsTotal = subscriptions.reduce((s, x) => s + x.bill.amount, 0);

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

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('bills.sectionCredits')}</h2>
          <button type="button" className="btn-link" onClick={() => navigate('/bills/new')}>
            {t('bills.addCreditLink')}
          </button>
        </div>
        {credits.length === 0 ? (
          <EmptyState icon="🏦" title={t('bills.emptyTitle')} hint={t('bills.emptyHint')} />
        ) : (
          <div className="debts-list">
            {credits.map((s) => (
              <CreditRow key={s.bill.id} status={s} progress={getCreditProgress(s.bill, transactions!)} currency={settings.currency} />
            ))}
          </div>
        )}
      </section>

      <Link to="/subscriptions" className="account-list-row">
        <span className="account-list-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
          🔄
        </span>
        <span className="account-list-info">
          <span className="account-list-name">{t('bills.sectionSubscriptions')}</span>
          <span className="account-list-bank">
            {subscriptions.length === 0
              ? t('bills.emptySubscriptionsHint')
              : t('bills.subscriptionsCountHint', { count: subscriptions.length, amount: formatMoney(subscriptionsTotal, settings.currency) })}
          </span>
        </span>
        <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
      </Link>
    </div>
  );
}
