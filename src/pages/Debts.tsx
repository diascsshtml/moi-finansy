import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Handshake, PieChart } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { DebtRow } from '../components/DebtRow';
import { CreditRow } from '../components/CreditRow';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../utils/format';
import { getDebtTotals } from '../utils/stats';
import { getAllBillStatuses, getCreditProgress, isLoanKind, resolveBillKind } from '../utils/bills';
import type { DebtDirection } from '../types';

export function Debts() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const [showClosed, setShowClosed] = useState(false);

  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const bills = useLiveQuery(() => db.bills.toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const multiAccount = (accounts?.length ?? 0) > 1;

  const credits = useMemo(() => {
    if (!bills || !transactions) return [];
    return getAllBillStatuses(bills, transactions).filter((s) =>
      isLoanKind(resolveBillKind(s.bill, categoriesById.get(s.bill.categoryId))),
    );
  }, [bills, transactions, categoriesById]);

  const list = useMemo(() => {
    if (!debts) return [];
    return debts
      .filter((d) => d.direction === direction)
      .filter((d) => showClosed || d.status === 'open')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.date.localeCompare(a.date);
      });
  }, [debts, direction, showClosed]);

  const { owedToMe, iOwe } = useMemo(() => (debts ? getDebtTotals(debts) : { owedToMe: 0, iOwe: 0 }), [debts]);
  const net = owedToMe - iOwe;

  if (!debts || !people || !accounts || !bills || !transactions || !categories) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-icon-row">
          <span className="page-header-icon" aria-hidden="true">
            <Handshake size={19} strokeWidth={2.25} />
          </span>
          <h1>{t('debts.titleFull')}</h1>
        </div>
      </header>

      <p className="section-label">{t('debts.overviewLabel')}</p>
      <div className="stat-row stat-row-3">
        <div className="stat-card overview-card">
          <span className="overview-icon overview-icon--positive">
            <ArrowDownLeft size={16} strokeWidth={2.25} />
          </span>
          <span className="stat-card-label">{t('debts.owedToMe')}</span>
          <div className="stat-card-value tone-positive">{formatMoney(owedToMe, settings.currency)}</div>
        </div>
        <div className="stat-card overview-card">
          <span className="overview-icon overview-icon--negative">
            <ArrowUpRight size={16} strokeWidth={2.25} />
          </span>
          <span className="stat-card-label">{t('debts.iOwe')}</span>
          <div className="stat-card-value tone-negative">{formatMoney(iOwe, settings.currency)}</div>
        </div>
        <div className="stat-card overview-card">
          <span className="overview-icon overview-icon--danger">
            <PieChart size={16} strokeWidth={2.25} />
          </span>
          <span className="stat-card-label">{t('debts.netTitle')}</span>
          <div className={`stat-card-value tone-${net >= 0 ? 'positive' : 'negative'}`}>{formatMoney(Math.abs(net), settings.currency)}</div>
          <div className="stat-card-hint">{net >= 0 ? t('debts.netInMyFavor') : t('debts.netNotInMyFavor')}</div>
        </div>
      </div>

      {owedToMe + iOwe > 0 && (
        <div className="debts-balance-bar">
          <div className="debts-balance-bar-fill debts-balance-bar-fill--positive" style={{ width: `${(owedToMe / (owedToMe + iOwe)) * 100}%` }} />
          <div className="debts-balance-bar-fill debts-balance-bar-fill--negative" style={{ width: `${(iOwe / (owedToMe + iOwe)) * 100}%` }} />
        </div>
      )}

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'owed_to_me'}
          className={direction === 'owed_to_me' ? 'active' : ''}
          onClick={() => setDirection('owed_to_me')}
        >
          {t('debts.owedToMe')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'i_owe'}
          className={direction === 'i_owe' ? 'active' : ''}
          onClick={() => setDirection('i_owe')}
        >
          {t('debts.iOwe')}
        </button>
      </div>

      <label className="checkbox-row checkbox-row--compact">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
        <span>{t('debts.showClosed')}</span>
      </label>

      <p className="section-label">{t('debts.activeListTitle')}</p>
      {list.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={direction === 'owed_to_me' ? t('debts.emptyOwedToMeTitle') : t('debts.emptyIOweTitle')}
          hint={direction === 'owed_to_me' ? t('debts.emptyHint') : t('debts.emptyHintIOwe')}
        />
      ) : (
        <div className="debts-list">
          {list.map((d) => (
            <DebtRow
              key={d.id}
              debt={d}
              person={peopleById.get(d.personId)}
              currency={settings.currency}
              account={multiAccount ? accountsById.get(d.accountId) : undefined}
            />
          ))}
        </div>
      )}

      <section className="recent-section">
        <div className="section-header">
          <h2>{t('bills.sectionCredits')}</h2>
        </div>
        {credits.length === 0 ? (
          <p className="settings-hint">{t('bills.emptyCreditsHint')}</p>
        ) : (
          <>
            <div className="debts-list">
              {credits.slice(0, 3).map((s) => (
                <CreditRow key={s.bill.id} status={s} progress={getCreditProgress(s.bill, transactions)} currency={settings.currency} />
              ))}
            </div>
            {credits.length > 3 && (
              <Link to="/bills" className="btn-link">
                {t('bills.seeAllCredits', { count: credits.length })}
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
