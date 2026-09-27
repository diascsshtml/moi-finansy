import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Bell, Calendar, CalendarClock, ChevronLeft, CircleHelp } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { BillRow } from '../components/BillRow';
import { EmptyState } from '../components/EmptyState';
import { dateToISO, formatDateShort, formatMoney } from '../utils/format';
import { getAllBillStatuses, resolveBillKind } from '../utils/bills';

export function SubscriptionsPage() {
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const navigate = useNavigate();

  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const subscriptions = useMemo(() => {
    if (!bills || !transactions) return [];
    return getAllBillStatuses(bills, transactions).filter(
      (s) => resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId)) === 'subscription',
    );
  }, [bills, transactions, categoriesById]);

  const activeSubscriptions = useMemo(() => subscriptions.filter((s) => s.bill.isActive), [subscriptions]);
  const monthlyTotal = useMemo(() => activeSubscriptions.reduce((s, x) => s + x.bill.amount, 0), [activeSubscriptions]);
  const yearlyTotal = monthlyTotal * 12;
  const soonest = useMemo(
    () => activeSubscriptions.slice().sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0],
    [activeSubscriptions],
  );

  if (!bills || !transactions || !categories) return null;

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} />
        </button>
        <h1>{t('subscriptions.title')}</h1>
        <span className="icon-btn" aria-hidden="true" style={{ visibility: 'hidden' }} />
      </header>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon="🔄"
          title={t('subscriptions.emptyTitle')}
          hint={t('subscriptions.emptyHint')}
          action={
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/subscriptions/new')}>
              + {t('subscriptions.addButton')}
            </button>
          }
        />
      ) : (
        <>
          <p className="section-label">{t('subscriptions.overviewLabel')}</p>
          <div className="stat-row stat-row-3">
            <div className="stat-card overview-card">
              <span className="overview-icon overview-icon--positive">
                <Calendar size={16} strokeWidth={2.25} />
              </span>
              <span className="stat-card-label">{t('subscriptions.perMonth')}</span>
              <div className="stat-card-value">{formatMoney(monthlyTotal, settings.currency)}</div>
              <div className="stat-card-hint">{t('subscriptions.activeCount', { count: activeSubscriptions.length })}</div>
            </div>
            <div className="stat-card overview-card">
              <span className="overview-icon overview-icon--negative">
                <CalendarClock size={16} strokeWidth={2.25} />
              </span>
              <span className="stat-card-label">{t('subscriptions.perYear')}</span>
              <div className="stat-card-value">{formatMoney(yearlyTotal, settings.currency)}</div>
            </div>
            <div className="stat-card overview-card">
              <span className="overview-icon overview-icon--danger">
                <Bell size={16} strokeWidth={2.25} />
              </span>
              <span className="stat-card-label">{t('subscriptions.closest')}</span>
              <div className="stat-card-value">{soonest ? formatMoney(soonest.bill.amount, settings.currency) : '—'}</div>
              {soonest && (
                <div className="stat-card-hint">
                  {soonest.bill.name} · {formatDateShort(dateToISO(soonest.dueDate))}
                </div>
              )}
            </div>
          </div>

          <section className="recent-section">
            <div className="section-header">
              <h2>{t('subscriptions.activeSection')}</h2>
              <Link to="/subscriptions/new" className="btn-link">
                {t('subscriptions.addLink')}
              </Link>
            </div>
            <div className="debts-list">
              {subscriptions.map((s) => (
                <BillRow key={s.bill.id} status={s} currency={settings.currency} isDark={isDark} linkBase="/subscriptions" />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="debt-detail-card">
        <div className="debt-detail-header-row">
          <span className="debt-detail-icon" style={{ width: 36, height: 36, background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
            <CircleHelp size={18} />
          </span>
          <div className="debt-detail-name-col">
            <strong>{t('subscriptions.howItWorksTitle')}</strong>
          </div>
        </div>
        <p className="settings-hint" style={{ marginTop: 10 }}>
          {t('subscriptions.howItWorksBody')}
        </p>
      </div>
    </div>
  );
}
