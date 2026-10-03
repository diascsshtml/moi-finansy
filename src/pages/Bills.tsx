import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { CreditRow } from '../components/CreditRow';
import { EmptyState } from '../components/EmptyState';
import { getAllBillStatuses, getCreditProgress, isLoanKind, resolveBillKind } from '../utils/bills';

export function Bills() {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const credits = useMemo(() => {
    if (!bills || !transactions) return [];
    return getAllBillStatuses(bills, transactions).filter((s) =>
      isLoanKind(resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId))),
    );
  }, [bills, transactions, categoriesById]);

  if (!bills || !transactions || !categories) return null;

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('bills.title')}</h1>
        <p className="page-subtitle">{t('bills.subtitle')}</p>
      </header>

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('bills.sectionCredits')}</h2>
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
    </div>
  );
}
