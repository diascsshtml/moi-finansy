import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { addTransaction } from '../db/operations';
import { todayISO } from '../utils/format';
import { db } from '../db/db';
import type { TransactionType } from '../types';

export function NewTransactionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { type: typeParam } = useParams<{ type: string }>();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [type, setType] = useState<TransactionType>(typeParam === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && !!categoryId && !!accountId && !!date;
  const showAccountPicker = accounts && accounts.length > 1;

  const handleTypeSwitch = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
  };

  const handleSave = async () => {
    if (!canSave || !categoryId || !accountId) {
      setError(t('transaction.error'));
      return;
    }
    await addTransaction({ type, amount: numericAmount, categoryId, accountId, date, note, counterparty });
    navigate(-1);
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{type === 'income' ? t('transaction.newIncomeTitle') : t('transaction.newExpenseTitle')}</h1>
      </header>

      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={type === 'expense'}
          className={type === 'expense' ? 'active' : ''}
          onClick={() => handleTypeSwitch('expense')}
        >
          {t('transaction.expense')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={type === 'income'}
          className={type === 'income' ? 'active' : ''}
          onClick={() => handleTypeSwitch('income')}
        >
          {t('transaction.income')}
        </button>
      </div>

      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

      {showAccountPicker && (
        <>
          <label className="field-label">{t('transaction.account')}</label>
          <AccountPicker value={accountId} onChange={setAccountIdOverride} />
        </>
      )}

      <label className="field-label" htmlFor="tx-date">
        {t('common.date')}
      </label>
      <input id="tx-date" type="date" className="text-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />

      <label className="field-label">{t('transaction.category')}</label>
      <CategoryPicker type={type} value={categoryId} onChange={setCategoryId} />

      <label className="field-label" htmlFor="tx-counterparty">
        {type === 'income' ? t('transaction.counterpartyIncome') : t('transaction.counterpartyExpense')}
      </label>
      <input
        id="tx-counterparty"
        type="text"
        className="text-input"
        placeholder={t('transaction.counterpartyPlaceholder')}
        value={counterparty}
        onChange={(e) => setCounterparty(e.target.value)}
        maxLength={60}
      />

      <label className="field-label" htmlFor="tx-note">
        {t('common.noteOptional')}
      </label>
      <input
        id="tx-note"
        type="text"
        className="text-input"
        placeholder={t('transaction.notePlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />

      {error && <p className="field-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave} onClick={handleSave}>
        {t('common.save')}
      </button>
    </div>
  );
}
