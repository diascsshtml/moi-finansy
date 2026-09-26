import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { HistoryEntryRow } from '../components/HistoryEntryRow';
import { EmptyState } from '../components/EmptyState';
import { buildHistory } from '../utils/history';
import { dateToISO, formatDateHuman, formatMonthYearFull, formatMoney } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';
import { toDisplayColor } from '../styles/palette';
import { EmojiIcon } from '../utils/icons';
import { getAccountBalances, getCategoryBreakdown } from '../utils/stats';

type TypeFilter = 'all' | 'income' | 'expense' | 'debt' | 'transfer';
type ViewTab = 'list' | 'categories' | 'accounts';
type CategoryType = 'expense' | 'income';

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function History() {
  const { t } = useTranslation();
  const { settings, isDark } = useSettings();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);

  const [monthOffset, setMonthOffset] = useState(0);
  const [viewTab, setViewTab] = useState<ViewTab>('list');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  const ready = transactions && debts && categories && people && debtPayments && accounts && transfers;
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const multiAccount = (accounts?.length ?? 0) > 1;

  const monthDate = useMemo(() => startOfMonth(addMonths(new Date(), monthOffset)), [monthOffset]);
  const monthStart = useMemo(() => dateToISO(monthDate), [monthDate]);
  const monthEnd = useMemo(() => dateToISO(endOfMonth(monthDate)), [monthDate]);
  const monthLabel = useMemo(() => capitalize(formatMonthYearFull(monthDate)), [monthDate]);

  const monthTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(
      (tx) => tx.date >= monthStart && tx.date <= monthEnd && (accountFilter === 'all' || tx.accountId === accountFilter),
    );
  }, [transactions, monthStart, monthEnd, accountFilter]);

  const monthIncome = useMemo(() => monthTransactions.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0), [monthTransactions]);
  const monthExpense = useMemo(() => monthTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0), [monthTransactions]);
  const monthNet = monthIncome - monthExpense;

  const { barPct, barColor, barHint } = useMemo(() => {
    if (monthIncome <= 0 && monthExpense <= 0) return { barPct: 0, barColor: 'var(--grid)', barHint: null as string | null };
    if (monthIncome <= 0) return { barPct: 100, barColor: 'var(--danger)', barHint: t('history.noIncomeHint') };
    const ratio = monthExpense / monthIncome;
    const pct = Math.min(ratio, 1) * 100;
    if (ratio >= 1) return { barPct: pct, barColor: 'var(--danger)', barHint: t('history.overIncomeHint') };
    return { barPct: pct, barColor: 'var(--accent-bright)', barHint: t('history.spentOfIncomeHint', { percent: Math.round(ratio * 100) }) };
  }, [monthIncome, monthExpense, t]);

  const all = useMemo(() => {
    if (!ready) return [];
    return buildHistory(transactions!, debts!, debtPayments!, people!, categories!, transfers!, accounts!, t);
  }, [ready, transactions, debts, debtPayments, people, categories, transfers, accounts, t]);

  const filtered = useMemo(() => {
    let list = all.filter((e) => e.date >= monthStart && e.date <= monthEnd);

    if (typeFilter === 'income') list = list.filter((e) => e.kind === 'income');
    else if (typeFilter === 'expense') list = list.filter((e) => e.kind === 'expense');
    else if (typeFilter === 'debt') list = list.filter((e) => e.kind.startsWith('debt'));
    else if (typeFilter === 'transfer') list = list.filter((e) => e.kind === 'transfer');

    if (accountFilter !== 'all') {
      list = list.filter((e) => e.accountId === accountFilter || e.transfer?.toAccountId === accountFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || (e.subtitle ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [all, monthStart, monthEnd, typeFilter, accountFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const categoryRows = useMemo(
    () => (categories ? getCategoryBreakdown(monthTransactions, categories, categoryType, t) : []),
    [monthTransactions, categories, categoryType, t],
  );
  const categoryRowsTotal = useMemo(() => categoryRows.reduce((s, r) => s + r.amount, 0), [categoryRows]);

  const accountNets = useMemo(() => {
    if (!transactions || !transfers) return new Map<string, number>();
    const monthTx = transactions.filter((tx) => tx.date >= monthStart && tx.date <= monthEnd);
    const monthTr = transfers.filter((tr) => tr.date >= monthStart && tr.date <= monthEnd);
    return getAccountBalances(monthTx, monthTr);
  }, [transactions, transfers, monthStart, monthEnd]);

  if (!ready) return null;

  const activeAccount = accountFilter !== 'all' ? accountsById.get(accountFilter) : undefined;

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('history.title')}</h1>
      </header>

      <div className="month-nav">
        <button type="button" className="month-nav-arrow" onClick={() => setMonthOffset((o) => o - 1)} aria-label={t('history.prevMonth')}>
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        <span className="month-nav-label">{monthLabel}</span>
        <button
          type="button"
          className="month-nav-arrow"
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={monthOffset >= 0}
          aria-label={t('history.nextMonth')}
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>

      <div className="period-summary-card">
        <div className="period-summary-row">
          <div className="period-summary-col">
            <span className="period-summary-label">{t('history.typeIncome')}</span>
            <span className="period-summary-value tone-positive">{formatMoney(monthIncome, settings.currency)}</span>
          </div>
          <div className="period-summary-col">
            <span className="period-summary-label">{t('history.typeExpense')}</span>
            <span className="period-summary-value tone-negative">{formatMoney(monthExpense, settings.currency)}</span>
          </div>
          <div className="period-summary-col">
            <span className="period-summary-label">{t('history.summaryTotal')}</span>
            <span className={`period-summary-value tone-${monthNet >= 0 ? 'positive' : 'negative'}`}>
              {formatMoney(monthNet, settings.currency, { signed: true })}
            </span>
          </div>
        </div>
        <div className="debt-progress-track">
          <div className="debt-progress-fill" style={{ width: `${barPct}%`, background: barColor }} />
        </div>
        {barHint && <p className="period-summary-hint">{barHint}</p>}
      </div>

      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={viewTab === 'list'} className={viewTab === 'list' ? 'active' : ''} onClick={() => setViewTab('list')}>
          {t('history.viewList')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'categories'}
          className={viewTab === 'categories' ? 'active' : ''}
          onClick={() => setViewTab('categories')}
        >
          {t('history.viewCategories')}
        </button>
        {multiAccount && (
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'accounts'}
            className={viewTab === 'accounts' ? 'active' : ''}
            onClick={() => setViewTab('accounts')}
          >
            {t('history.viewAccounts')}
          </button>
        )}
      </div>

      {activeAccount && viewTab !== 'accounts' && (
        <button type="button" className="filter-chip filter-chip--account" onClick={() => setAccountFilter('all')}>
          <EmojiIcon icon={activeAccount.icon} size={13} className="inline-icon" /> {accountDisplayName(activeAccount, t)}
          <X size={13} strokeWidth={2.5} className="inline-icon" />
        </button>
      )}

      {viewTab === 'list' && (
        <>
          <div className="chip-scroll-row">
            {(
              [
                ['all', t('history.filterAll')],
                ['expense', t('history.typeExpense')],
                ['income', t('history.typeIncome')],
                ['transfer', t('history.typeTransfer')],
                ['debt', t('history.typeDebt')],
              ] as [TypeFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`filter-chip${typeFilter === value ? ' active' : ''}`}
                onClick={() => setTypeFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <input
            type="search"
            className="text-input search-input"
            placeholder={t('history.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {groups.length === 0 ? (
            <EmptyState icon="🔍" title={t('history.emptyTitle')} hint={t('history.emptyHint')} />
          ) : (
            <div className="history-groups">
              {groups.map(([date, entries]) => {
                const dayTotal = entries.reduce((s, e) => {
                  if (e.kind === 'income') return s + e.amount;
                  if (e.kind === 'expense') return s - e.amount;
                  return s;
                }, 0);
                return (
                  <div key={date} className="history-group">
                    <div className="history-group-header">
                      <Link to={`/history/day/${date}`} className="history-group-date">
                        {formatDateHuman(date)}
                      </Link>
                      <span className={`history-group-total tone-${dayTotal >= 0 ? 'positive' : 'negative'}`}>
                        {formatMoney(dayTotal, settings.currency, { signed: true })}
                      </span>
                    </div>
                    <div className="history-list">
                      {entries.map((e) => (
                        <HistoryEntryRow key={e.id} entry={e} currency={settings.currency} isDark={isDark} accountsById={accountsById} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {viewTab === 'categories' && (
        <>
          <div className="chip-scroll-row">
            <button
              type="button"
              className={`filter-chip${categoryType === 'expense' ? ' active' : ''}`}
              onClick={() => setCategoryType('expense')}
            >
              {t('history.typeExpense')}
            </button>
            <button
              type="button"
              className={`filter-chip${categoryType === 'income' ? ' active' : ''}`}
              onClick={() => setCategoryType('income')}
            >
              {t('history.typeIncome')}
            </button>
          </div>

          {categoryRows.length === 0 ? (
            <EmptyState icon="🔍" title={t('history.emptyTitle')} hint={t('history.emptyHint')} />
          ) : (
            <div className="category-breakdown-list">
              {categoryRows.map((row) => {
                const color = toDisplayColor(row.color, isDark);
                const pct = categoryRowsTotal > 0 ? (row.amount / categoryRowsTotal) * 100 : 0;
                return (
                  <div key={row.categoryId} className="category-breakdown-row">
                    <span className="category-breakdown-icon" style={{ background: `${color}26`, color }} aria-hidden="true">
                      <EmojiIcon icon={row.icon} size={16} />
                    </span>
                    <div className="category-breakdown-info">
                      <div className="category-breakdown-top">
                        <span>{row.name}</span>
                        <span>{formatMoney(row.amount, settings.currency)}</span>
                      </div>
                      <div className="mini-progress-track">
                        <div className="mini-progress-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {viewTab === 'accounts' && (
        <>
          <p className="settings-hint">{t('history.accountsHint')}</p>
          <div className="account-balances-row">
            {accounts!.map((a) => (
              <button
                key={a.id}
                type="button"
                className="account-balance-chip"
                onClick={() => {
                  setAccountFilter(a.id);
                  setViewTab('list');
                }}
              >
                <span
                  className="account-list-icon"
                  style={{ background: `${toDisplayColor(a.color, isDark)}26`, color: toDisplayColor(a.color, isDark) }}
                >
                  <EmojiIcon icon={a.icon} size={17} />
                </span>
                <span className="account-balance-info">
                  <span className="account-list-name">{accountDisplayName(a, t)}</span>
                  {a.bank && <span className="account-list-bank">{a.bank}</span>}
                  <span className={`account-balance-value tone-${(accountNets.get(a.id) ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatMoney(accountNets.get(a.id) ?? 0, settings.currency, { signed: true })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
