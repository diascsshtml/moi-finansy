import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../components/AmountInput';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { db } from '../db/db';
import { createTransfer } from '../db/operations';
import { todayISO } from '../utils/format';

export function NewTransferPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const from = fromAccountId ?? accounts?.[0]?.id ?? null;
  const to = toAccountId ?? accounts?.find((a) => a.id !== from)?.id ?? null;
  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && !!from && !!to && from !== to && !!date;

  const handleSave = async () => {
    if (!canSave || !from || !to) return;
    setSaving(true);
    await createTransfer({ fromAccountId: from, toAccountId: to, amount: numericAmount, date, note });
    setSaving(false);
    navigate(-1);
  };

  if (accounts && accounts.length < 2) {
    return (
      <div className="page">
        <header className="page-header">
          <button type="button" className="btn-link" onClick={() => navigate(-1)}>
            ← {t('common.cancel')}
          </button>
          <h1>{t('transfer.title')}</h1>
        </header>
        <p className="sheet-subtitle">{t('transfer.needTwoAccounts')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('transfer.title')}</h1>
      </header>

      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

      <label className="field-label">{t('transfer.from')}</label>
      <AccountPicker value={from} onChange={setFromAccountId} />

      <label className="field-label">{t('transfer.to')}</label>
      <AccountPicker value={to} onChange={setToAccountId} exclude={from ?? undefined} />

      <label className="field-label" htmlFor="transfer-date">
        {t('common.date')}
      </label>
      <input id="transfer-date" type="date" className="text-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

      <label className="field-label" htmlFor="transfer-note">
        {t('common.noteOptional')}
      </label>
      <input id="transfer-note" type="text" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />

      {from && to && from === to && <p className="field-error">{t('transfer.sameAccountError')}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave || saving} onClick={handleSave}>
        {t('transfer.save')}
      </button>
    </div>
  );
}
