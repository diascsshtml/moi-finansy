import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSheet } from '../context/SheetContext';
import { useSettings } from '../context/SettingsContext';
import { getAccountBalances } from '../utils/stats';
import { formatMoney } from '../utils/format';
import { accountDisplayName } from '../utils/displayName';

export function Accounts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { open } = useSheet();
  const { settings } = useSettings();

  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);

  const balances = useMemo(
    () => (transactions && transfers ? getAccountBalances(transactions, transfers) : new Map<string, number>()),
    [transactions, transfers],
  );

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('accountsPage.back')}
        </button>
        <h1>{t('accountsPage.title')}</h1>
        <p className="page-subtitle">{t('accountsPage.subtitle')}</p>
      </header>

      <div className="accounts-list">
        {accounts?.map((a) => (
          <button
            key={a.id}
            type="button"
            className="account-list-row"
            onClick={() => open({ kind: 'edit-account', account: a })}
          >
            <span className="account-list-icon" style={{ background: `${a.color}26`, color: a.color }}>
              {a.icon}
            </span>
            <span className="account-list-info">
              <span className="account-list-name">{accountDisplayName(a, t)}</span>
              {a.bank && <span className="account-list-bank">{a.bank}</span>}
              <span className="account-list-balance">{formatMoney(balances.get(a.id) ?? 0, settings.currency)}</span>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'edit-account' })}>
        {t('accountsPage.addButton')}
      </button>
    </div>
  );
}
