import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { AmountInput } from './AmountInput';
import { CategoryPicker } from './CategoryPicker';
import { AccountPicker } from './AccountPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { useSettings } from '../context/SettingsContext';
import { createBill, deleteBill, updateBill } from '../db/operations';
import { db } from '../db/db';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { dateToISO, todayISO } from '../utils/format';
import { getDueDateInMonth } from '../utils/bills';
import { EmojiIcon } from '../utils/icons';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { BillPreset, RecurringBill } from '../types';

const REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 14];
const ICONS = [
  '💳', '🏦', '📱', '📺', '🎵', '🌐', '🏠', '🚗', '💊', '🎓', '🛡️', '📦',
  '💡', '🚰', '🔥', '♨️', '🗑️', '🏢', '🎬', '▶️', '☁️', '🟡', '🏋️',
];
const SWATCHES = CATEGORICAL_LIGHT;

interface AddBillSheetProps {
  onClose: () => void;
  bill?: RecurringBill;
  preset?: BillPreset;
}

export function AddBillSheet({ onClose, bill, preset }: AddBillSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const isEdit = !!bill;
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const defaultCategoryNameKey = bill ? null : (preset?.categoryNameKey ?? 'categoryNames.loanPayments');
  const defaultCategoryId = useLiveQuery(async () => {
    if (!defaultCategoryNameKey) return null;
    const cat = await db.categories.filter((c) => c.nameKey === defaultCategoryNameKey).first();
    return cat?.id ?? SYSTEM_CATEGORY_IDS.otherExpense;
  }, [defaultCategoryNameKey]);

  const [name, setName] = useState(bill?.name ?? preset?.name ?? '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [dueDate, setDueDate] = useState(
    bill ? dateToISO(getDueDateInMonth(bill.dayOfMonth, new Date())) : todayISO(),
  );
  const [reminderDaysBefore, setReminderDaysBefore] = useState(bill?.reminderDaysBefore ?? 3);
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null>(bill?.categoryId ?? null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(bill?.accountId ?? null);
  const [icon, setIcon] = useState(bill?.icon ?? preset?.icon ?? ICONS[0]);
  const [color, setColor] = useState(bill?.color ?? preset?.color ?? SWATCHES[7]);
  const [note, setNote] = useState(bill?.note ?? '');
  const [isActive, setIsActive] = useState(bill?.isActive ?? true);
  const [notifyEnabled, setNotifyEnabled] = useState(bill?.notifyEnabled ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryId = categoryIdOverride ?? defaultCategoryId ?? null;
  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const numericAmount = Number(amount);
  const dayOfMonth = dueDate ? Number(dueDate.split('-')[2]) : 0;
  const canSave = name.trim().length > 0 && numericAmount > 0 && dayOfMonth > 0 && !!categoryId && !!accountId;
  const showAccountPicker = accounts && accounts.length > 1;

  const handleSave = async () => {
    if (!canSave || !categoryId || !accountId) {
      setError(t('bills.form.error'));
      return;
    }
    // Включили уведомления по этому платежу — если разрешение браузера ещё
    // не запрашивали, спрашиваем прямо сейчас. Если откажут — просто не
    // покажется само уведомление, remindersDaysBefore/бейдж в приложении на
    // это не завязаны.
    if (notifyEnabled && getNotificationPermission() === 'default') {
      await requestNotificationPermission();
    }
    if (isEdit && bill) {
      await updateBill(bill.id, {
        name,
        amount: numericAmount,
        dayOfMonth,
        reminderDaysBefore,
        categoryId,
        accountId,
        icon,
        color,
        note,
        isActive,
        notifyEnabled,
      });
    } else {
      await createBill({
        name,
        amount: numericAmount,
        dayOfMonth,
        firstDueDate: dueDate,
        reminderDaysBefore,
        categoryId,
        accountId,
        icon,
        color,
        note,
        notifyEnabled,
      });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (bill) await deleteBill(bill.id);
    onClose();
  };

  return (
    <Sheet
      title={isEdit ? t('bills.form.editTitle') : t('bills.form.newTitle')}
      onClose={onClose}
      footer={
        <div className="sheet-footer-row">
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-grow" disabled={!canSave} onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      }
    >
      <label className="field-label" htmlFor="bill-name">
        {t('common.name')}
      </label>
      <input
        id="bill-name"
        type="text"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('bills.form.namePlaceholder')}
        maxLength={60}
        autoFocus
      />

      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} />

      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="bill-day">
            {t('bills.form.dayOfMonth')}
          </label>
          <input
            id="bill-day"
            type="date"
            className="text-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <small className="settings-hint">{t('bills.form.dayOfMonthHint')}</small>
        </div>
        <div>
          <label className="field-label" htmlFor="bill-reminder">
            {t('bills.form.reminderDays')}
          </label>
          <select
            id="bill-reminder"
            className="select-input"
            value={reminderDaysBefore}
            onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
          >
            {REMINDER_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAccountPicker && (
        <>
          <label className="field-label">{t('transaction.account')}</label>
          <AccountPicker value={accountId} onChange={setAccountIdOverride} />
        </>
      )}

      <label className="field-label">{t('transaction.category')}</label>
      <CategoryPicker type="expense" value={categoryId} onChange={setCategoryIdOverride} />

      <label className="field-label">{t('common.icon')}</label>
      <div className="icon-grid">
        {ICONS.map((i) => (
          <button
            key={i}
            type="button"
            className={`icon-swatch${icon === i ? ' selected' : ''}`}
            onClick={() => setIcon(i)}
            aria-label={i}
          >
            <EmojiIcon icon={i} size={19} />
          </button>
        ))}
      </div>

      <label className="field-label">{t('common.color')}</label>
      <div className="color-grid">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-swatch${color === c ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>

      <label className="field-label" htmlFor="bill-note">
        {t('common.noteOptional')}
      </label>
      <input
        id="bill-note"
        type="text"
        className="text-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />

      <label className="checkbox-row">
        <input type="checkbox" checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} />
        <span>
          {t('bills.form.notifyToggle')}
          <small>{t('bills.form.notifyHint')}</small>
        </span>
      </label>

      {isEdit && (
        <label className="checkbox-row">
          <input type="checkbox" checked={!isActive} onChange={(e) => setIsActive(!e.target.checked)} />
          <span>
            {t('bills.form.pauseToggle')}
            <small>{t('bills.form.pauseHint')}</small>
          </span>
        </label>
      )}

      {error && <p className="field-error">{error}</p>}

      {confirmDelete && (
        <ConfirmDialog
          title={t('bills.form.deleteTitle')}
          message={t('bills.form.deleteMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
