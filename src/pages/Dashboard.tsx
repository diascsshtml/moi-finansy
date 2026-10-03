import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, User } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useAccount } from '../context/AccountContext';
import { StatCard } from '../components/StatCard';
import { HistoryEntryRow } from '../components/HistoryEntryRow';
import { EmptyState } from '../components/EmptyState';
import { BillsAlertBanner } from '../components/BillsAlertBanner';
import { buildHistory } from '../utils/history';
import { formatDateHuman, formatMoney, formatWeekdayDate, todayISO } from '../utils/format';
import { toDisplayColor } from '../styles/palette';
import { accountDisplayName } from '../utils/displayName';
import { EmojiIcon } from '../utils/icons';
import { getBillsNeedingAttention } from '../utils/bills';
import { notifyAboutBills } from '../utils/notifications';
import { getAccountBalances, getCashBalance, getDebtTotals, isWithinCurrentMonth } from '../utils/stats';

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t('dashboard.greetingMorning');
  if (hour >= 12 && hour < 18) return t('dashboard.greetingDay');
  if (hour >= 18 && hour < 23) return t('dashboard.greetingEvening');
  return t('dashboard.greetingNight');
}

export function Dashboard() {
  const { t } = useTranslation();
  const { settings, isDark, setHideBalance } = useSettings();
  const { user } = useAccount();
  const hideBalance = !!settings.hideBalance;
  const mask = (text: string) => (hideBalance ? t('dashboard.hiddenValue') : text);
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
    const filtered = scope === 'all' ? all : all.filter((e) => e.accountId === scope || e.transfer?.toAccountId === scope);
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
      <header className="dashboard-header">
        <Link to="/settings" className="dashboard-header-avatar" aria-label={t('nav.profile')}>
          <span className="profile-avatar-ring profile-avatar-ring--sm" aria-hidden="true">
            <span className="profile-avatar-circle">
              {user?.avatar ? <img src={user.avatar} alt="" className="profile-avatar-photo" /> : <User size={20} strokeWidth={1.75} />}
            </span>
          </span>
        </Link>
        <div className="dashboard-header-text">
          <p className="dashboard-header-date">{formatWeekdayDate(new Date())}</p>
          <h1 className="dashboard-header-greeting">
            {getGreeting(t)}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <button
          type="button"
          className="icon-btn dashboard-hide-balance-btn"
          onClick={() => void setHideBalance(!hideBalance)}
          aria-label={hideBalance ? t('dashboard.showBalance') : t('dashboard.hideBalance')}
        >
          {hideBalance ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
        </button>
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
        value={mask(formatMoney(balance, settings.currency))}
        tone={balance >= 0 ? 'positive' : 'negative'}
        hint={t('dashboard.thisMonth', { value: mask(formatMoney(monthNet, settings.currency, { signed: true })) })}
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
                  {mask(formatMoney(accountBalances.get(a.id) ?? 0, settings.currency))}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="stat-row">
        <StatCard
          label={t('dashboard.owedToMe')}
          value={mask(formatMoney(debtTotals.owedToMe, settings.currency))}
          tone={debtTotals.owedToMe > 0 ? 'positive' : 'neutral'}
          icon={<ArrowDownLeft size={16} strokeWidth={2.25} />}
        />
        <StatCard
          label={t('dashboard.iOwe')}
          value={mask(formatMoney(debtTotals.iOwe, settings.currency))}
          tone={debtTotals.iOwe > 0 ? 'negative' : 'neutral'}
          icon={<ArrowUpRight size={16} strokeWidth={2.25} />}
        />
      </div>

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
