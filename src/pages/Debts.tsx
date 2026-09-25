import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { DebtRow } from '../components/DebtRow';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../utils/format';
import type { DebtDirection } from '../types';

export function Debts() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { open } = useSheet();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const [showClosed, setShowClosed] = useState(false);

  const debts = useLiveQuery(() => db.debts.toArray(), []);
  const people = useLiveQuery(() => db.people.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

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

  const total = useMemo(
    () => list.filter((d) => d.status === 'open').reduce((s, d) => s + d.currentAmount, 0),
    [list],
  );

  if (!debts || !people || !accounts) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-row">
          <h1>{t('debts.title')}</h1>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open({ kind: 'add-debt', direction })}>
            {t('debts.addButton')}
          </button>
        </div>
      </header>

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

      <div className="debts-total">
        <span>{direction === 'owed_to_me' ? t('debts.totalOwedToMe') : t('debts.totalIOwe')}</span>
        <strong className={direction === 'owed_to_me' ? 'tone-positive' : 'tone-negative'}>
          {formatMoney(total, settings.currency)}
        </strong>
      </div>

      <label className="checkbox-row checkbox-row--compact">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
        <span>{t('debts.showClosed')}</span>
      </label>

      {list.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={direction === 'owed_to_me' ? t('debts.emptyOwedToMeTitle') : t('debts.emptyIOweTitle')}
          hint={t('debts.emptyHint')}
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
    </div>
  );
}
