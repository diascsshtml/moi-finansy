import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useAccount } from '../context/AccountContext';
import { StatCard } from '../components/StatCard';
import { HistoryEntryRow } from '../components/HistoryEntryRow';
import { EmptyState } from '../components/EmptyState';
import { BillsAlertBanner } from '../components/BillsAlertBanner';
import { buildHistory } from '../utils/history';
import { formatDateHuman, formatMoney, todayISO } from '../utils/format';
import { toDisplayColor } from '../styles/palette';
import { accountDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import { getBillsNeedingAttention } from '../utils/bills';
import { notifyAboutBills } from '../utils/notifications';
import { getAccountBalances, getCashBalance, getDebtTotals, isWithinCurrentMonth } from '../utils/stats';

export function Dashboard() {
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const { user } = useAccount();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);
  const bills = useLiveQuery(() => db.bills.toArray(), []);

  const [scope, setScope] = useState<'all' | string>('all');

  const billsNeedingAttention = useMemo(
    () => (bills && transactions ? getBillsNeedingAttention(bills, transactions) : []),
    [bills, transactions],
  );

  // Показываем системное уведомление максимум раз в день на платёж — именно
  // в момент, когда пользователь реально открыл приложение (см. utils/notifications.ts
  // про то, почему полноценный push здесь невозможен без сервера).
  const attentionCount = billsNeedingAttention.length;
  useEffect(() => {
    if (attentionCount === 0) return;
    void notifyAboutBills(billsNeedingAttention, settings.currency, t, todayISO());
    // Специально реагируем только на изменение количества, а не самого массива
    // (он пересоздаётся почти на каждом рендере) — иначе будет спамить проверками.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionCount]);

  const ready = transactions && debts && categories && people && debtPayments && accounts && transfers;

  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const multiAccount = (accounts?.length ?? 0) > 1;

  const scopedDebts = useMemo(() => {
    if (!debts) return [];
    return scope === 'all' ? debts : debts.filter((d) => d.accountId === scope);
  }, [debts, scope]);

  const accountBalances = useMemo(
    () => (transactions && transfers ? getAccountBalances(transactions, transfers) : new Map<string, number>()),
    [transactions, transfers],
  );
  // Баланс счёта обязан учитывать и переводы между счетами, не только доходы/расходы —
  // иначе после перевода цифра на карточке счёта не сходится с фактическим остатком.
  const balance = useMemo(
    () => (scope === 'all' ? getCashBalance(transactions ?? []) : accountBalances.get(scope) ?? 0),
    [scope, transactions, accountBalances],
  );
  const monthNet = useMemo(() => {
    const monthTxAll = (transactions ?? []).filter((tx) => isWithinCurrentMonth(tx.date));
    const monthTransfersAll = (transfers ?? []).filter((tr) => isWithinCurrentMonth(tr.date));
    if (scope === 'all') return getCashBalance(monthTxAll);
    return getAccountBalances(monthTxAll, monthTransfersAll).get(scope) ?? 0;
  }, [scope, transactions, transfers]);
  const debtTotals = useMemo(() => getDebtTotals(scopedDebts), [scopedDebts]);
  const recent = useMemo(() => {
    if (!ready) return [];
    const all = buildHistory(transactions!, debts!, debtPayments!, people!, categories!, transfers!, accounts!, t);
    const filtered =
      scope === 'all'
        ? all
        : all.filter((e) => e.accountId === scope || e.transfer?.toAccountId === scope);
    return filtered.slice(0, 6);
  }, [ready, transactions, debts, debtPayments, people, categories, transfers, accounts, scope, t]);

  const recentGroups = useMemo(() => {
    const map = new Map<string, typeof recent>();
    for (const e of recent) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries());
  }, [recent]);

  if (!ready) return null;

  return (
    <div className="page">
      <header className="page-header">
        {user ? (
          <>
            <h1>{user.name || `@${user.username}`}</h1>
            {user.name && <p className="page-subtitle">@{user.username}</p>}
          </>
        ) : (
          <>
            <h1>{t('dashboard.title')}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle')}</p>
          </>
        )}
      </header>

      <BillsAlertBanner statuses={billsNeedingAttention} />

      {multiAccount && (
        <div className="segmented scope-switch" role="tablist">
          <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
            {t('dashboard.all')}
          </button>
          {accounts!.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={scope === a.id}
              className={scope === a.id ? 'active' : ''}
              onClick={() => setScope(a.id)}
            >
              <EmojiIcon icon={a.icon} size={14} className="inline-icon" /> {accountDisplayName(a, t)}
            </button>
          ))}
        </div>
      )}

      <StatCard
        label={scope === 'all' ? t('dashboard.balance') : t('dashboard.balanceOf', { name: accountDisplayName(accountsById.get(scope), t) })}
        value={formatMoney(balance, settings.currency)}
        tone={balance >= 0 ? 'positive' : 'negative'}
        hint={t('dashboard.thisMonth', { value: formatMoney(monthNet, settings.currency, { signed: true }) })}
        emphasis
      />

      {multiAccount && scope === 'all' && (
        <div className="account-balances-row">
          {accounts!.map((a) => (
            <button key={a.id} type="button" className="account-balance-chip" onClick={() => setScope(a.id)}>
              <span
                className="account-list-icon"
                style={{ background: `${toDisplayColor(a.color, isDark)}26`, color: toDisplayColor(a.color, isDark) }}
              >
                <EmojiIcon icon={a.icon} size={17} />
              </span>
              <span className="account-balance-info">
                <span className="account-list-name">{accountDisplayName(a, t)}</span>
                {a.bank && <span className="account-list-bank">{a.bank}</span>}
                <span className={`account-balance-value tone-${(accountBalances.get(a.id) ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatMoney(accountBalances.get(a.id) ?? 0, settings.currency)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="stat-row">
        <StatCard
          label={t('dashboard.owedToMe')}
          value={formatMoney(debtTotals.owedToMe, settings.currency)}
          tone={debtTotals.owedToMe > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label={t('dashboard.iOwe')}
          value={formatMoney(debtTotals.iOwe, settings.currency)}
          tone={debtTotals.iOwe > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <Link to="/stats" className="account-list-row">
        <span className="account-list-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
          <BarChart3 size={17} />
        </span>
        <span className="account-list-info">
          <span className="account-list-name">{t('dashboard.statsButton')}</span>
          <span className="account-list-bank">{t('dashboard.statsButtonHint')}</span>
        </span>
        <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
      </Link>

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('dashboard.recentOperations')}</h2>
          <Link to="/history" className="btn-link">
            {t('dashboard.seeAll')}
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon="💸" title={t('dashboard.emptyTitle')} hint={t('dashboard.emptyHint')} />
        ) : (
          <div className="history-groups">
            {recentGroups.map(([date, entries]) => (
              <div key={date} className="history-group">
                <Link to={`/history/day/${date}`} className="history-group-date">
                  {formatDateHuman(date)}
                </Link>
                <div className="history-list">
                  {entries.map((e) => (
                    <HistoryEntryRow key={e.id} entry={e} currency={settings.currency} isDark={isDark} accountsById={accountsById} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
