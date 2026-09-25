import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { ExpenseDonut } from '../components/charts/ExpenseDonut';
import { IncomeExpenseBars } from '../components/charts/IncomeExpenseBars';
import { accountDisplayName } from '../utils/displayName';
import { getCategoryBreakdown, getMonthlySeries, isWithinCurrentMonth } from '../utils/stats';

export function Stats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, isDark } = useSettings();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [scope, setScope] = useState<'all' | string>('all');
  const multiAccount = (accounts?.length ?? 0) > 1;

  const scopedTx = useMemo(() => {
    if (!transactions) return [];
    return scope === 'all' ? transactions : transactions.filter((tx) => tx.accountId === scope);
  }, [transactions, scope]);
  const monthTx = useMemo(() => scopedTx.filter((tx) => isWithinCurrentMonth(tx.date)), [scopedTx]);
  const expenseRows = useMemo(
    () => (categories ? getCategoryBreakdown(monthTx, categories, 'expense', t) : []),
    [monthTx, categories, t],
  );
  const monthlySeries = useMemo(() => getMonthlySeries(scopedTx, 6), [scopedTx]);

  if (!transactions || !categories || !accounts) return null;

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/')}>
          {t('stats.back')}
        </button>
        <h1>{t('stats.title')}</h1>
        <p className="page-subtitle">{t('stats.subtitle')}</p>
      </header>

      {multiAccount && (
        <div className="segmented scope-switch" role="tablist">
          <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
            {t('dashboard.all')}
          </button>
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={scope === a.id}
              className={scope === a.id ? 'active' : ''}
              onClick={() => setScope(a.id)}
            >
              {a.icon} {accountDisplayName(a, t)}
            </button>
          ))}
        </div>
      )}

      <ExpenseDonut rows={expenseRows} currency={settings.currency} isDark={isDark} title={t('dashboard.expensesThisMonth')} />
      <IncomeExpenseBars data={monthlySeries} currency={settings.currency} isDark={isDark} />
    </div>
  );
}
