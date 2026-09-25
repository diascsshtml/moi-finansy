import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { AmountInput } from './AmountInput';
import { useSettings } from '../context/SettingsContext';
import { markBillPaid } from '../db/operations';
import { todayISO } from '../utils/format';
import type { RecurringBill } from '../types';

interface MarkBillPaidSheetProps {
  onClose: () => void;
  bill: RecurringBill;
}

export function MarkBillPaidSheet({ onClose, bill }: MarkBillPaidSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [amount, setAmount] = useState(String(bill.amount));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && !!date;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await markBillPaid({ billId: bill.id, amount: numericAmount, date, note });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet
      title={`${t('bills.markPaid.title')}: ${bill.name}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-grow" disabled={!canSave || saving} onClick={handleSave}>
          {t('bills.markPaid.save')}
        </button>
      }
    >
      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

      <label className="field-label" htmlFor="bill-payment-date">
        {t('common.date')}
      </label>
      <input
        id="bill-payment-date"
        type="date"
        className="text-input"
        value={date}
        max={todayISO()}
        onChange={(e) => setDate(e.target.value)}
      />

      <label className="field-label" htmlFor="bill-payment-note">
        {t('common.noteOptional')}
      </label>
      <input
        id="bill-payment-note"
        type="text"
        className="text-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />
    </Sheet>
  );
}
