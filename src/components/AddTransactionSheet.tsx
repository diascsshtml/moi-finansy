import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { AmountInput } from './AmountInput';
import { CategoryPicker } from './CategoryPicker';
import { AccountPicker } from './AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { deleteTransaction, updateTransaction } from '../db/operations';
import { todayISO } from '../utils/format';
import { db } from '../db/db';
import type { Transaction } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface AddTransactionSheetProps {
  onClose: () => void;
  transaction: Transaction;
}

/** Редактирование существующей операции — создание новой перенесено на
 *  отдельную страницу (см. NewTransactionPage), этот лист теперь только
 *  для правки уже сохранённой записи. */
export function AddTransactionSheet({ onClose, transaction }: AddTransactionSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const type = transaction.type;
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState<string | null>(transaction.categoryId);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note ?? '');
  const [counterparty, setCounterparty] = useState(transaction.counterparty ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Явный выбор пользователя важнее исходного счёта операции.
  const accountId = accountIdOverride ?? transaction.accountId ?? accounts?.[0]?.id ?? null;

  const numericAmount = Number(amount);
  const canSave = numericAmount > 0 && !!categoryId && !!accountId && !!date;

  const handleSave = async () => {
    if (!canSave || !categoryId || !accountId) {
      setError(t('transaction.error'));
      return;
    }
    await updateTransaction(transaction.id, { amount: numericAmount, categoryId, accountId, date, note, counterparty });
    onClose();
  };

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    onClose();
  };

  const showAccountPicker = accounts && accounts.length > 1;

  return (
    <Sheet
      title={t('transaction.editTitle')}
      onClose={onClose}
      footer={
        <div className="sheet-footer-row">
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            {t('common.delete')}
          </button>
          <button type="button" className="btn btn-primary btn-grow" disabled={!canSave} onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      }
    >
      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} />

      {showAccountPicker && (
        <>
          <label className="field-label">{t('transaction.account')}</label>
          <AccountPicker value={accountId} onChange={setAccountIdOverride} />
        </>
      )}

      <label className="field-label" htmlFor="tx-date">
        {t('common.date')}
      </label>
      <input
        id="tx-date"
        type="date"
        className="text-input"
        value={date}
        max={todayISO()}
        onChange={(e) => setDate(e.target.value)}
      />

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

      {confirmDelete && (
        <ConfirmDialog
          title={t('transaction.deleteTitle')}
          message={t('transaction.deleteMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
