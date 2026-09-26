import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { createBill } from '../db/operations';
import { db } from '../db/db';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { todayISO } from '../utils/format';
import { EmojiIcon } from '../utils/icons';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { BillPreset } from '../types';

const REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 14];
const ICONS = [
  '💳', '🏦', '📱', '📺', '🎵', '🌐', '🏠', '🚗', '💊', '🎓', '🛡️', '📦',
  '💡', '🚰', '🔥', '♨️', '🗑️', '🏢', '🎬', '▶️', '☁️', '🟡', '🏋️',
];
const SWATCHES = CATEGORICAL_LIGHT;

export function NewBillFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const location = useLocation();
  const preset = location.state as BillPreset | undefined;
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const defaultCategoryNameKey = preset?.categoryNameKey ?? 'categoryNames.loanPayments';
  const defaultCategoryId = useLiveQuery(async () => {
    const cat = await db.categories.filter((c) => c.nameKey === defaultCategoryNameKey).first();
    return cat?.id ?? SYSTEM_CATEGORY_IDS.otherExpense;
  }, [defaultCategoryNameKey]);

  const [name, setName] = useState(preset?.name ?? '');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null>(null);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [icon, setIcon] = useState(preset?.icon ?? ICONS[0]);
  const [color, setColor] = useState(preset?.color ?? SWATCHES[7]);
  const [note, setNote] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(true);
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
    if (notifyEnabled && getNotificationPermission() === 'default') {
      await requestNotificationPermission();
    }
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
    navigate(-2);
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('bills.form.newTitle')}</h1>
      </header>

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
          <input id="bill-day" type="date" className="text-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
          <button key={i} type="button" className={`icon-swatch${icon === i ? ' selected' : ''}`} onClick={() => setIcon(i)} aria-label={i}>
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
      <input id="bill-note" type="text" className="text-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />

      <label className="checkbox-row">
        <input type="checkbox" checked={notifyEnabled} onChange={(e) => setNotifyEnabled(e.target.checked)} />
        <span>
          {t('bills.form.notifyToggle')}
          <small>{t('bills.form.notifyHint')}</small>
        </span>
      </label>

      {error && <p className="field-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave} onClick={handleSave}>
        {t('common.save')}
      </button>
    </div>
  );
}
