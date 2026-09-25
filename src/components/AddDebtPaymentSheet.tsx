import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { AmountInput } from './AmountInput';
import { useSettings } from '../context/SettingsContext';
import { addDebtPayment } from '../db/operations';
import { todayISO, formatMoney } from '../utils/format';
import { db } from '../db/db';
import type { Debt } from '../types';

interface AddDebtPaymentSheetProps {
  onClose: () => void;
  debt: Debt;
}

export function AddDebtPaymentSheet({ onClose, debt }: AddDebtPaymentSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const person = useLiveQuery(() => db.people.get(debt.personId), [debt.personId]);
  const [amount, setAmount] = useState(String(debt.currentAmount));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && numericAmount <= debt.currentAmount + 0.001 && !!date;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await addDebtPayment({ debtId: debt.id, amount: numericAmount, date, note });
    setSaving(false);
    onClose();
  };

  const label = debt.direction === 'i_owe' ? t('debtPayment.iPay') : t('debtPayment.theyPay');

  return (
    <Sheet
      title={`${label}: ${person?.name ?? ''}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-grow"
          disabled={!canSave || saving}
          onClick={handleSave}
        >
          {t('debtPayment.save')}
        </button>
      }
    >
      <p className="sheet-subtitle">
        {t('debtPayment.remaining')}
        <strong>{formatMoney(debt.currentAmount, settings.currency)}</strong>
      </p>

      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />
      <button
        type="button"
        className="btn-link"
        onClick={() => setAmount(String(debt.currentAmount))}
      >
        {t('debtPayment.payInFull')}
      </button>

      <label className="field-label" htmlFor="payment-date">
        {t('common.date')}
      </label>
      <input
        id="payment-date"
        type="date"
        className="text-input"
        value={date}
        max={todayISO()}
        onChange={(e) => setDate(e.target.value)}
      />

      <label className="field-label" htmlFor="payment-note">
        {t('common.noteOptional')}
      </label>
      <input
        id="payment-note"
        type="text"
        className="text-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />

      {numericAmount > debt.currentAmount && <p className="field-error">{t('debtPayment.tooMuchError')}</p>}
    </Sheet>
  );
}
