import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, RotateCw, Wallet } from 'lucide-react';
import { AmountInput } from '../components/AmountInput';
import { SubscriptionPickerSheet } from '../components/SubscriptionPickerSheet';
import { useSettings } from '../context/SettingsContext';
import { createBill } from '../db/operations';
import { db } from '../db/db';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { accountDisplayName, categoryDisplayName } from '../utils/displayName';
import { formatDateShort, todayISO } from '../utils/format';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { SubscriptionCatalogItem } from '../data/subscriptionCatalog';

const ENTERTAINMENT_KEY = 'categoryNames.entertainment';

export function NewSubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const entertainmentCategory = useLiveQuery(
    () => db.categories.filter((c) => c.nameKey === ENTERTAINMENT_KEY).first(),
    [],
  );

  const [showPicker, setShowPicker] = useState(false);
  const [picked, setPicked] = useState<SubscriptionCatalogItem | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const account = accounts?.find((a) => a.id === accountId);
  const numericAmount = Number(amount);
  const dayOfMonth = dueDate ? Number(dueDate.split('-')[2]) : 0;
  const canSave = name.trim().length > 0 && numericAmount > 0 && dayOfMonth > 0 && !!accountId;

  const missingHint = !name.trim()
    ? t('subscriptions.hintName')
    : numericAmount <= 0
      ? t('subscriptions.hintPrice')
      : !accountId
        ? t('subscriptions.hintAccount')
        : null;

  const handlePick = (item: SubscriptionCatalogItem | null) => {
    setShowPicker(false);
    if (item) {
      setPicked(item);
      setName(item.name);
    } else {
      setPicked(null);
    }
  };

  const handleSave = async () => {
    if (!canSave || !accountId) {
      setError(t('bills.form.error'));
      return;
    }
    const categoryId = entertainmentCategory?.id ?? SYSTEM_CATEGORY_IDS.otherExpense;
    if (getNotificationPermission() === 'default') {
      await requestNotificationPermission();
    }
    await createBill({
      name,
      amount: numericAmount,
      dayOfMonth,
      firstDueDate: dueDate,
      categoryId,
      accountId,
      icon: picked?.icon ?? name.slice(0, 1).toUpperCase(),
      color: picked?.color ?? CATEGORICAL_LIGHT[4],
      kind: 'subscription',
      notifyEnabled: true,
    });
    navigate('/subscriptions', { replace: true });
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('subscriptions.newTitle')}</h1>
      </header>

      <button type="button" className="grouped-list-row" onClick={() => setShowPicker(true)}>
        <span className="grouped-list-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
          ?
        </span>
        <span className="grouped-list-info">
          <span className="grouped-list-name">{t('subscriptions.pickFromListLabel')}</span>
          <span className="grouped-list-hint">{t('subscriptions.pickFromListHint')}</span>
        </span>
        <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
      </button>

      <label className="field-label">{t('subscriptions.priceLabel')}</label>
      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} />

      <label className="field-label" htmlFor="subscription-name">
        {t('common.name')}
      </label>
      <input
        id="subscription-name"
        type="text"
        className="text-input"
        placeholder={t('subscriptions.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />

      <p className="section-label">{t('subscriptions.conditionsTitle')}</p>
      <div className="grouped-list">
        <div className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <RotateCw size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('subscriptions.frequencyLabel')}</span>
            <span className="grouped-list-hint">{t('subscriptions.frequencyHint')}</span>
          </span>
          <span className="grouped-list-trailing">{t('subscriptions.frequencyMonthly')}</span>
        </div>

        <label className="grouped-list-row condition-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <Calendar size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('subscriptions.nextChargeLabel')}</span>
            <span className="grouped-list-hint">{t('subscriptions.nextChargeHint')}</span>
          </span>
          <span className="grouped-list-trailing">{formatDateShort(dueDate)}</span>
          <input type="date" className="condition-row-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t('subscriptions.nextChargeLabel')} />
        </label>

        {accounts && accounts.length > 1 ? (
          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Wallet size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('subscriptions.accountLabel')}</span>
              <span className="grouped-list-hint">{t('subscriptions.accountHint')}</span>
            </span>
            <span className="grouped-list-trailing">{account ? accountDisplayName(account, t) : ''}</span>
            <select
              className="condition-row-input"
              value={accountId ?? ''}
              onChange={(e) => setAccountIdOverride(e.target.value)}
              aria-label={t('subscriptions.accountLabel')}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountDisplayName(a, t)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grouped-list-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Wallet size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('subscriptions.accountLabel')}</span>
              <span className="grouped-list-hint">{t('subscriptions.accountHint')}</span>
            </span>
            <span className="grouped-list-trailing">{account ? accountDisplayName(account, t) : ''}</span>
          </div>
        )}

        <div className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            💫
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('transaction.category')}</span>
          </span>
          <span className="grouped-list-trailing">{entertainmentCategory ? categoryDisplayName(entertainmentCategory, t) : ''}</span>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave} onClick={handleSave}>
        {t('subscriptions.addButton')}
      </button>
      {missingHint && <p className="settings-hint" style={{ textAlign: 'center' }}>{missingHint}</p>}

      {showPicker && <SubscriptionPickerSheet onClose={() => setShowPicker(false)} onPick={handlePick} />}
    </div>
  );
}
