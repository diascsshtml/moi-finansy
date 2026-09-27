import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { addMonths } from 'date-fns';
import { ChevronLeft, Landmark } from 'lucide-react';
import { Sheet } from './Sheet';
import { AmountInput } from './AmountInput';
import { useSettings } from '../context/SettingsContext';
import { db } from '../db/db';
import { markBillPaid } from '../db/operations';
import { accountDisplayName } from '../utils/displayName';
import { dateToISO, formatDateHuman, formatMoney, todayISO } from '../utils/format';
import { toDisplayColor } from '../styles/palette';
import { getAccountBalances } from '../utils/stats';
import { getCreditProgress, getDueDateInMonth } from '../utils/bills';
import { isMonogramIcon } from '../data/billCatalog';
import { EmojiIcon } from '../utils/icons';
import type { RecurringBill } from '../types';

interface CreditPaymentSheetProps {
  onClose: () => void;
  bill: RecurringBill;
}

type Step = 'form' | 'confirm' | 'success';

/** Внесение платежа по кредиту — по образцу референса: выбор счёта списания
 *  (не обязательно тот, что закреплён за платежом), быстрые суммы, экран
 *  проверки «до/после», и финальный экран успеха. Для подписок оставлен
 *  прежний простой лист (см. MarkBillPaidSheet) — там нет ни выбора счёта,
 *  ни прогресса погашения, усложнять незачем. */
export function CreditPaymentSheet({ onClose, bill }: CreditPaymentSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, isDark } = useSettings();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const transfers = useLiveQuery(() => db.transfers.toArray(), []);

  const [step, setStep] = useState<Step>('form');
  const [accountId, setAccountId] = useState(bill.accountId);
  const [amount, setAmount] = useState(String(bill.amount));
  const [saving, setSaving] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);

  const balances = useMemo(
    () => (transactions && transfers ? getAccountBalances(transactions, transfers) : new Map<string, number>()),
    [transactions, transfers],
  );
  const progress = useMemo(() => (transactions ? getCreditProgress(bill, transactions) : null), [bill, transactions]);

  if (!accounts || !transactions || !transfers || !progress) return null;

  const remaining = progress.totalAmount > 0 ? progress.remaining : bill.amount;
  const numericAmount = Number(amount);
  const account = accounts.find((a) => a.id === accountId);
  const accountBalance = accountId ? (balances.get(accountId) ?? 0) : 0;
  const balanceAfter = accountBalance - numericAmount;
  const remainingAfter = Math.max(remaining - numericAmount, 0);
  const canSubmit = numericAmount > 0 && !!accountId;

  const quickAmounts = [
    { key: 'monthly', label: t('bills.payment.quickMonthly'), value: bill.amount },
    { key: 'half', label: t('bills.payment.quickHalf'), value: Math.round((remaining / 2) * 100) / 100 },
    { key: 'full', label: t('bills.payment.quickFull'), value: remaining },
  ].filter((qa) => qa.value > 0);

  const nextDueAfterPayment = dateToISO(getDueDateInMonth(bill.dayOfMonth, addMonths(new Date(), 1)));

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await markBillPaid({ billId: bill.id, amount: numericAmount, date: todayISO(), accountId: accountId ?? undefined });
    setPaidAmount(numericAmount);
    setSaving(false);
    setStep('success');
  };

  const billIcon = isMonogramIcon(bill.icon) ? bill.icon : <EmojiIcon icon={bill.icon} size={22} />;
  const billColor = toDisplayColor(bill.color, isDark);

  if (step === 'success') {
    return (
      <Sheet title="" onClose={onClose}>
        <div className="payment-success">
          <span className="payment-success-check" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="payment-success-title">{t('bills.payment.successTitle')}</h2>
          <div className="payment-success-amount">{formatMoney(paidAmount, settings.currency)}</div>

          <div className="account-list-row payment-success-summary">
            <span className="account-list-info payment-success-summary-list">
              <span className="credit-confirm-row">
                <span className="credit-confirm-row-label">{t('bills.payment.balanceAfter')}</span>
                <span className="credit-confirm-row-value">{formatMoney(balanceAfter, settings.currency)}</span>
              </span>
              <span className="credit-confirm-row">
                <span className="credit-confirm-row-label">{t('bills.payment.remainingAfter')}</span>
                <span className="credit-confirm-row-value">{formatMoney(remainingAfter, settings.currency)}</span>
              </span>
              {remainingAfter > 0 && (
                <span className="credit-confirm-row">
                  <span className="credit-confirm-row-label">{t('bills.payment.nextPaymentDate')}</span>
                  <span className="credit-confirm-row-value">{formatDateHuman(nextDueAfterPayment)}</span>
                </span>
              )}
            </span>
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          {t('bills.payment.done')}
        </button>
        <button
          type="button"
          className="btn-link payment-success-link"
          onClick={() => {
            onClose();
            navigate(`/bills/${bill.id}`);
          }}
        >
          {t('bills.payment.viewCredit')}
        </button>
      </Sheet>
    );
  }

  if (step === 'confirm') {
    return (
      <Sheet title={t('bills.payment.confirmTitle')} onClose={onClose}>
        <button type="button" className="btn-link payment-back-link" onClick={() => setStep('form')}>
          <ChevronLeft size={16} strokeWidth={2.5} className="inline-icon" /> {t('common.back')}
        </button>

        <div className="credit-confirm-parties">
          <span className="credit-confirm-party">
            <span
              className="account-list-icon"
              style={account ? { background: `${toDisplayColor(account.color, isDark)}26`, color: toDisplayColor(account.color, isDark) } : undefined}
            >
              {account && <EmojiIcon icon={account.icon} size={17} />}
            </span>
            <span className="credit-confirm-party-name">{account ? accountDisplayName(account, t) : ''}</span>
            <span className="credit-confirm-party-hint">{formatMoney(accountBalance, settings.currency)}</span>
          </span>
          <span className="credit-confirm-arrow" aria-hidden="true">
            →
          </span>
          <span className="credit-confirm-party">
            <span className="account-list-icon" style={{ background: `${billColor}26`, color: billColor }}>
              {billIcon}
            </span>
            <span className="credit-confirm-party-name">{bill.name}</span>
            <span className="credit-confirm-party-hint">{formatMoney(remaining, settings.currency)}</span>
          </span>
        </div>

        <div className="credit-confirm-row">
          <span className="credit-confirm-row-label">{t('bills.payment.amountLabel')}</span>
          <span className="credit-confirm-row-value">{formatMoney(numericAmount, settings.currency)}</span>
        </div>
        <div className="credit-confirm-row">
          <span className="credit-confirm-row-label">{t('bills.payment.feeLabel')}</span>
          <span className="credit-confirm-row-value">{formatMoney(0, settings.currency)}</span>
        </div>
        <div className="credit-confirm-row credit-confirm-row--highlight">
          <span className="credit-confirm-row-label">{t('bills.payment.debitedLabel')}</span>
          <span className="credit-confirm-row-value tone-negative">{formatMoney(numericAmount, settings.currency)}</span>
        </div>

        <p className="section-label">{t('bills.payment.afterTitle')}</p>
        <div className="credit-confirm-row">
          <span className="credit-confirm-row-label">{t('bills.payment.balanceAfter')}</span>
          <span className="credit-confirm-row-value">{formatMoney(balanceAfter, settings.currency)}</span>
        </div>
        <div className="credit-confirm-row">
          <span className="credit-confirm-row-label">{t('bills.payment.remainingAfter')}</span>
          <span className="credit-confirm-row-value">{formatMoney(remainingAfter, settings.currency)}</span>
        </div>

        <button type="button" className="btn btn-primary btn-block" disabled={saving} onClick={handleConfirm}>
          {t('bills.payment.confirmButton')}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('bills.payment.title')} onClose={onClose}>
      <div className="payment-context-box">
        <span className="period-summary-label">{t('bills.detail.remainingLabel')}</span>
        <div className="debt-detail-amount tone-negative">{formatMoney(remaining, settings.currency)}</div>
      </div>

      <label className="field-label">{t('bills.payment.fromAccountLabel')}</label>
      <div className="grouped-list">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className="account-list-row"
            onClick={() => setAccountId(a.id)}
          >
            <span
              className="account-list-icon"
              style={{ background: `${toDisplayColor(a.color, isDark)}26`, color: toDisplayColor(a.color, isDark) }}
            >
              <EmojiIcon icon={a.icon} size={17} />
            </span>
            <span className="account-list-info">
              <span className="account-list-name">{accountDisplayName(a, t)}</span>
              <span className="account-list-bank">{formatMoney(balances.get(a.id) ?? 0, settings.currency)}</span>
            </span>
            <span className={`radio-dot${accountId === a.id ? ' selected' : ''}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      <label className="field-label">{t('bills.payment.amountLabel')}</label>
      <AmountInput value={amount} onChange={setAmount} currency={settings.currency} />
      <small className="settings-hint">{t('bills.payment.minAmountHint', { amount: formatMoney(1, settings.currency) })}</small>

      <label className="field-label">{t('bills.payment.quickAmountsLabel')}</label>
      <div className="quick-amount-row">
        {quickAmounts.map((qa) => (
          <button key={qa.key} type="button" className="quick-amount-chip" onClick={() => setAmount(String(qa.value))}>
            <span className="quick-amount-chip-label">{qa.label}</span>
            <span className="quick-amount-chip-value">{formatMoney(qa.value, settings.currency)}</span>
          </button>
        ))}
      </div>

      <div className="sheet-footer-row">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary btn-grow" disabled={!canSubmit} onClick={() => setStep('confirm')}>
          <Landmark size={16} strokeWidth={2.25} className="inline-icon" /> {t('bills.payment.payButton')}
        </button>
      </div>
    </Sheet>
  );
}
