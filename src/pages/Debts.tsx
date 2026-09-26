import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleHelp, Handshake, PieChart, Plus } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { DebtRow } from '../components/DebtRow';
import { EmptyState } from '../components/EmptyState';
import { Sheet } from '../components/Sheet';
import { formatMoney } from '../utils/format';
import { getDebtTotals } from '../utils/stats';
import type { DebtDirection } from '../types';

export function Debts() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const [showClosed, setShowClosed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const bills = useLiveQuery(() => db.bills.toArray(), []);

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const multiAccount = (accounts?.length ?? 0) > 1;

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

  const openOwedToMeCount = useMemo(
    () => new Set((debts ?? []).filter((d) => d.status === 'open' && d.direction === 'owed_to_me').map((d) => d.personId)).size,
    [debts],
  );
  const openIOweCount = useMemo(
    () => (debts ?? []).filter((d) => d.status === 'open' && d.direction === 'i_owe').length,
    [debts],
  );

  const activeBills = useMemo(() => (bills ?? []).filter((b) => b.isActive), [bills]);
  const activeBillsTotal = useMemo(() => activeBills.reduce((s, b) => s + b.amount, 0), [activeBills]);

  if (!debts || !people || !accounts || !bills) return null;

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
          <div className="stat-card-hint">{t('debts.peopleCount', { count: openOwedToMeCount })}</div>
        </div>
        <div className="stat-card overview-card">
          <span className="overview-icon overview-icon--negative">
            <ArrowUpRight size={16} strokeWidth={2.25} />
          </span>
          <span className="stat-card-label">{t('debts.iOwe')}</span>
          <div className="stat-card-value tone-negative">{formatMoney(iOwe, settings.currency)}</div>
          <div className="stat-card-hint">{t('debts.debtsCount', { count: openIOweCount })}</div>
        </div>
        <div className="stat-card overview-card">
          <span className="overview-icon overview-icon--positive">
            <PieChart size={16} strokeWidth={2.25} />
          </span>
          <span className="stat-card-label">{t('debts.netTitle')}</span>
          <div className={`stat-card-value tone-${net >= 0 ? 'positive' : 'negative'}`}>{formatMoney(Math.abs(net), settings.currency)}</div>
          <div className="stat-card-hint">{net >= 0 ? t('debts.netInMyFavor') : t('debts.netNotInMyFavor')}</div>
        </div>
      </div>

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

      {list.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={direction === 'owed_to_me' ? t('debts.emptyOwedToMeTitle') : t('debts.emptyIOweTitle')}
          hint={direction === 'owed_to_me' ? t('debts.emptyHint') : t('debts.emptyHintIOwe')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/debts/new/${direction}`)}>
              <Plus size={17} strokeWidth={2.5} className="inline-icon" style={{ marginRight: 4 }} />
              {t('debts.addButton').replace('+ ', '')}
            </button>
          }
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
          <h2>{t('debts.creditsSection')}</h2>
          <button type="button" className="btn-link" onClick={() => navigate('/bills/new')}>
            {t('debts.addCreditLink')}
          </button>
        </div>

        {activeBills.length === 0 ? (
          <p className="settings-hint">{t('debts.creditsEmpty')}</p>
        ) : (
          <Link to="/bills" className="settings-hint">
            {t('debts.creditsCountHint', { count: activeBills.length, amount: formatMoney(activeBillsTotal, settings.currency) })}
          </Link>
        )}

        <button type="button" className="account-list-row" onClick={() => setShowInfo(true)}>
          <span className="account-list-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
            <CircleHelp size={17} />
          </span>
          <span className="account-list-info">
            <span className="account-list-name">{t('debts.howItWorksTitle')}</span>
            <span className="account-list-bank">{t('debts.howItWorksHint')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>
      </section>

      {showInfo && (
        <Sheet title={t('debts.howItWorksTitle')} onClose={() => setShowInfo(false)}>
          <p className="settings-hint">{t('debts.howItWorksBody')}</p>
        </Sheet>
      )}
    </div>
  );
}
