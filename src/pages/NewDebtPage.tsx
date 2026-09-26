import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../components/AmountInput';
import { PersonPicker } from '../components/PersonPicker';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { createDebt } from '../db/operations';
import { todayISO } from '../utils/format';
import { db } from '../db/db';
import type { DebtDirection } from '../types';

export function NewDebtPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { direction: directionParam } = useParams<{ direction: string }>();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [direction, setDirection] = useState<DebtDirection>(directionParam === 'owed_to_me' ? 'owed_to_me' : 'i_owe');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [linkedToBalance, setLinkedToBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && personName.trim().length > 0 && !!date && !!accountId;
  const showAccountPicker = accounts && accounts.length > 1;

  const handleSave = async () => {
    if (!canSave || !accountId) {
      setError(t('debtForm.error'));
      return;
    }
    setSaving(true);
    await createDebt({
      personName,
      direction,
      amount: numericAmount,
      date,
      dueDate: dueDate || undefined,
      note,
      linkedToBalance,
      accountId,
    });
    setSaving(false);
    navigate(-1);
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('debtForm.title')}</h1>
      </header>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'i_owe'}
          className={direction === 'i_owe' ? 'active' : ''}
          onClick={() => setDirection('i_owe')}
        >
          {t('debtForm.iOwe')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'owed_to_me'}
          className={direction === 'owed_to_me' ? 'active' : ''}
          onClick={() => setDirection('owed_to_me')}
        >
          {t('debtForm.owedToMe')}
        </button>
      </div>

      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

      {showAccountPicker && (
        <>
          <label className="field-label">{t('debtForm.account')}</label>
          <AccountPicker value={accountId} onChange={setAccountIdOverride} />
        </>
      )}

      <label className="field-label" htmlFor="debt-person">
        {direction === 'i_owe' ? t('debtForm.whoIOwe') : t('debtForm.whoOwesMe')}
      </label>
      <PersonPicker id="debt-person" value={personName} onChange={setPersonName} />

      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="debt-date">
            {t('debtForm.dateCreated')}
          </label>
          <input id="debt-date" type="date" className="text-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="debt-due">
            {t('debtForm.dueDate')}
          </label>
          <input id="debt-due" type="date" className="text-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <label className="field-label" htmlFor="debt-note">
        {t('common.noteOptional')}
      </label>
      <input
        id="debt-note"
        type="text"
        className="text-input"
        placeholder={t('debtForm.notePlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />

      <label className="checkbox-row">
        <input type="checkbox" checked={linkedToBalance} onChange={(e) => setLinkedToBalance(e.target.checked)} />
        <span>
          {t('debtForm.linkToBalance')}
          <small>{direction === 'i_owe' ? t('debtForm.linkHintIOwe') : t('debtForm.linkHintOwedToMe')}</small>
        </span>
      </label>

      {error && <p className="field-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave || saving} onClick={handleSave}>
        {t('common.save')}
      </button>
    </div>
  );
}
