import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { HistoryEntryRow } from '../components/HistoryEntryRow';
import { EmptyState } from '../components/EmptyState';
import { buildHistory } from '../utils/history';
import { formatDateHuman, formatMoney } from '../utils/format';

export function DayDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const { settings, isDark } = useSettings();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const debtPayments = useLiveQuery(() => db.debtPayments.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);

  const ready = transactions && debts && categories && people && debtPayments && accounts && transfers;
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  const entries = useMemo(() => {
    if (!ready || !date) return [];
    const all = buildHistory(transactions!, debts!, debtPayments!, people!, categories!, transfers!, accounts!, t);
    return all.filter((e) => e.date === date);
  }, [ready, transactions, debts, debtPayments, people, categories, transfers, accounts, date, t]);

  const dayTotal = useMemo(() => {
    return entries.reduce((s, e) => {
      if (e.kind === 'income') return s + e.amount;
      if (e.kind === 'expense') return s - e.amount;
      return s;
    }, 0);
  }, [entries]);

  if (!ready) return null;

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          {t('dayDetail.back')}
        </button>
      </header>

      <header className="page-header">
        <h1>{date ? formatDateHuman(date) : ''}</h1>
        <p className="page-subtitle">
          {t('dayDetail.total', { amount: formatMoney(dayTotal, settings.currency, { signed: true }) })}
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState icon="🔍" title={t('history.emptyTitle')} hint={t('history.emptyHint')} />
      ) : (
        <div className="history-list">
          {entries.map((e) => (
            <HistoryEntryRow key={e.id} entry={e} currency={settings.currency} isDark={isDark} accountsById={accountsById} />
          ))}
        </div>
      )}
    </div>
  );
}
