import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { HistoryEntryRow } from '../components/HistoryEntryRow';
import { EmptyState } from '../components/EmptyState';
import { buildHistory } from '../utils/history';
import { dateToISO, formatDateHuman, formatMoney } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';
import { startOfMonth, startOfYear } from 'date-fns';

type TypeFilter = 'all' | 'income' | 'expense' | 'debt' | 'transfer';
type PeriodFilter = 'all' | 'month' | 'year';

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

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  const ready = transactions && debts && categories && people && debtPayments && accounts && transfers;
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const multiAccount = (accounts?.length ?? 0) > 1;

  const all = useMemo(() => {
    if (!ready) return [];
    return buildHistory(transactions!, debts!, debtPayments!, people!, categories!, transfers!, accounts!, t);
  }, [ready, transactions, debts, debtPayments, people, categories, transfers, accounts, t]);

  const filtered = useMemo(() => {
    let list = all;
    if (typeFilter === 'income') list = list.filter((e) => e.kind === 'income');
    else if (typeFilter === 'expense') list = list.filter((e) => e.kind === 'expense');
    else if (typeFilter === 'debt') list = list.filter((e) => e.kind.startsWith('debt'));
    else if (typeFilter === 'transfer') list = list.filter((e) => e.kind === 'transfer');

    if (accountFilter !== 'all') {
      list = list.filter((e) => e.accountId === accountFilter || e.transfer?.toAccountId === accountFilter);
    }

    if (period !== 'all') {
      const cutoff = period === 'month' ? startOfMonth(new Date()) : startOfYear(new Date());
      const cutoffStr = dateToISO(cutoff);
      list = list.filter((e) => e.date >= cutoffStr);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) => e.title.toLowerCase().includes(q) || (e.subtitle ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [all, typeFilter, period, accountFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const periodTotal = useMemo(() => {
    return filtered.reduce((s, e) => {
      if (e.kind === 'income') return s + e.amount;
      if (e.kind === 'expense') return s - e.amount;
      return s;
    }, 0);
  }, [filtered]);

  if (!ready) return null;

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('history.title')}</h1>
        <p className="page-subtitle">
          {t('history.subtitle', { amount: formatMoney(periodTotal, settings.currency, { signed: true }) })}
        </p>
      </header>

      <input
        type="search"
        className="text-input search-input"
        placeholder={t('history.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <select className="select-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
          <option value="all">{t('history.typeAll')}</option>
          <option value="income">{t('history.typeIncome')}</option>
          <option value="expense">{t('history.typeExpense')}</option>
          <option value="debt">{t('history.typeDebt')}</option>
          <option value="transfer">{t('history.typeTransfer')}</option>
        </select>
        <select className="select-input" value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
          <option value="all">{t('history.periodAll')}</option>
          <option value="month">{t('history.periodMonth')}</option>
          <option value="year">{t('history.periodYear')}</option>
        </select>
      </div>

      {multiAccount && (
        <select className="select-input" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="all">{t('history.accountAll')}</option>
          {accounts!.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {accountDisplayName(a, t)}
            </option>
          ))}
        </select>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="🔍" title={t('history.emptyTitle')} hint={t('history.emptyHint')} />
      ) : (
        <div className="history-groups">
          {groups.map(([date, entries]) => (
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
    </div>
  );
}
