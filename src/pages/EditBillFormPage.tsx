import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { AccountPicker } from '../components/AccountPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSettings } from '../context/SettingsContext';
import { deleteBill, updateBill } from '../db/operations';
import { db } from '../db/db';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { dateToISO } from '../utils/format';
import { getDueDateInMonth } from '../utils/bills';
import { EmojiIcon } from '../utils/icons';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { RecurringBill } from '../types';

const ICONS = [
  '💳', '🏦', '📱', '📺', '🎵', '🌐', '🏠', '🚗', '💊', '🎓', '🛡️', '📦',
  '💡', '🚰', '🔥', '♨️', '🗑️', '🏢', '🎬', '▶️', '☁️', '🟡', '🏋️',
];
const SWATCHES = CATEGORICAL_LIGHT;

/** Редактирование существующего регулярного платежа — отдельная страница
 *  вместо нижнего листа, как и создание (см. NewBillCatalogPage/NewBillFormPage).
 *  Само поле формы вынесено в EditBillForm — ждём загрузки bill из Dexie,
 *  чтобы вся начальная state формы инициализировалась уже реальными
 *  значениями (а не переинициализировалась постфактум через useEffect). */
export function EditBillFormPage() {
  const { id } = useParams<{ id: string }>();
  const bill = useLiveQuery(() => (id ? db.bills.get(id) : undefined), [id]);

  return bill ? <EditBillForm bill={bill} /> : null;
}

function EditBillForm({ bill }: { bill: RecurringBill }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [name, setName] = useState(bill.name);
  const [kind, setKind] = useState<'credit' | 'subscription'>(bill.kind ?? 'credit');
  const [amount, setAmount] = useState(String(bill.amount));
  const [totalAmount, setTotalAmount] = useState(bill.totalAmount ? String(bill.totalAmount) : '');
  const [interestRate, setInterestRate] = useState(bill.interestRate ? String(bill.interestRate) : '');
  const [dueDate, setDueDate] = useState(dateToISO(getDueDateInMonth(bill.dayOfMonth, new Date())));
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null>(bill.categoryId);
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(bill.accountId);
  const [icon, setIcon] = useState(bill.icon);
  const [color, setColor] = useState(bill.color);
  const [note, setNote] = useState(bill.note ?? '');
  const [isActive, setIsActive] = useState(bill.isActive);
  const [notifyEnabled, setNotifyEnabled] = useState(bill.notifyEnabled ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryId = categoryIdOverride ?? bill.categoryId;
  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const numericAmount = Number(amount);
  const numericTotalAmount = Number(totalAmount);
  const numericInterestRate = Number(interestRate);
  const dayOfMonth = dueDate ? Number(dueDate.split('-')[2]) : 0;
  const canSave =
    name.trim().length > 0 &&
    numericAmount > 0 &&
    dayOfMonth > 0 &&
    !!categoryId &&
    !!accountId &&
    (kind !== 'credit' || numericTotalAmount > 0);
  const showAccountPicker = accounts && accounts.length > 1;

  const handleSave = async () => {
    if (!canSave || !categoryId || !accountId) {
      setError(t('bills.form.error'));
      return;
    }
    if (notifyEnabled && getNotificationPermission() === 'default') {
      await requestNotificationPermission();
    }
    await updateBill(bill.id, {
      name,
      amount: numericAmount,
      dayOfMonth,
      categoryId,
      accountId,
      icon,
      color,
      kind,
      totalAmount: kind === 'credit' ? numericTotalAmount : undefined,
      interestRate: kind === 'credit' && numericInterestRate > 0 ? numericInterestRate : undefined,
      note,
      isActive,
      notifyEnabled,
    });
    navigate(-1);
  };

  const handleDelete = async () => {
    await deleteBill(bill.id);
    navigate('/bills', { replace: true });
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('bills.form.editTitle')}</h1>
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

      <label className="field-label">{t('bills.form.kindLabel')}</label>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'credit'} className={kind === 'credit' ? 'active' : ''} onClick={() => setKind('credit')}>
          {t('bills.kindCredit')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'subscription'}
          className={kind === 'subscription' ? 'active' : ''}
          onClick={() => setKind('subscription')}
        >
          {t('bills.kindSubscription')}
        </button>
      </div>

      {kind === 'credit' && (
        <>
          <label className="field-label" htmlFor="edit-bill-total-amount">
            {t('bills.form.totalAmountLabel')}
          </label>
          <AmountInput id="edit-bill-total-amount" value={totalAmount} onChange={setTotalAmount} currency={settings.currency} />

          <label className="field-label" htmlFor="edit-bill-interest-rate">
            {t('bills.form.interestRateLabel')}
          </label>
          <input
            id="edit-bill-interest-rate"
            type="text"
            inputMode="decimal"
            className="text-input"
            placeholder="0"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
          />

          <label className="field-label">{t('bills.form.monthlyPaymentLabel')}</label>
        </>
      )}
      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} />

      <label className="field-label" htmlFor="bill-day">
        {t('bills.form.dayOfMonth')}
      </label>
      <input id="bill-day" type="date" className="text-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <small className="settings-hint">{t('bills.form.dayOfMonthHint')}</small>

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

      <label className="checkbox-row">
        <input type="checkbox" checked={!isActive} onChange={(e) => setIsActive(!e.target.checked)} />
        <span>
          {t('bills.form.pauseToggle')}
          <small>{t('bills.form.pauseHint')}</small>
        </span>
      </label>

      {error && <p className="field-error">{error}</p>}

      <div className="sheet-footer-row">
        <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
          {t('common.delete')}
        </button>
        <button type="button" className="btn btn-primary btn-grow" disabled={!canSave} onClick={handleSave}>
          {t('common.save')}
        </button>
      </div>

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
    </div>
  );
}
