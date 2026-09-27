import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Gift, Landmark } from 'lucide-react';
import { AmountInput } from '../components/AmountInput';
import { PersonPicker } from '../components/PersonPicker';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { createDebt, createBill } from '../db/operations';
import { todayISO } from '../utils/format';
import { db } from '../db/db';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { DebtDirection } from '../types';

type Mode = DebtDirection | 'credit' | 'installment';

const CREDIT_COLOR = '#e5484d'; // var(--danger), захардкожен для inline-style тайла (см. .mode-tile.active)
const INSTALLMENT_COLOR = CATEGORICAL_LIGHT[1]; // тёплый оранжевый — отличает рассрочку от кредита

export function NewDebtPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { direction: directionParam } = useParams<{ direction: string }>();
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [mode, setMode] = useState<Mode>(directionParam === 'owed_to_me' ? 'owed_to_me' : 'i_owe');

  // Простой долг человеку
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [linkedToBalance, setLinkedToBalance] = useState(false);

  // Кредит/рассрочка — те же поля, что и на странице «Кредиты и подписки»
  // (см. NewBillFormPage), просто доступны сразу со старта «+ Долг».
  const [loanName, setLoanName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [loanDueDate, setLoanDueDate] = useState(todayISO());

  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLoanMode = mode === 'credit' || mode === 'installment';
  const defaultCategoryId = useLiveQuery(async () => {
    const cat = await db.categories.filter((c) => c.nameKey === 'categoryNames.loanPayments').first();
    return cat?.id ?? SYSTEM_CATEGORY_IDS.otherExpense;
  }, []);

  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? null;
  const numericAmount = Number(amount);
  const numericTotalAmount = Number(totalAmount);
  const numericInterestRate = Number(interestRate);
  const numericTermMonths = Number(termMonths);
  const numericMonthlyAmount = Number(monthlyAmount);
  const loanDayOfMonth = loanDueDate ? Number(loanDueDate.split('-')[2]) : 0;
  const showAccountPicker = accounts && accounts.length > 1;

  const canSave = isLoanMode
    ? loanName.trim().length > 0 && numericTotalAmount > 0 && numericMonthlyAmount > 0 && loanDayOfMonth > 0 && !!accountId
    : numericAmount > 0 && personName.trim().length > 0 && !!date && !!accountId;

  const handleSave = async () => {
    if (!canSave || !accountId) {
      setError(t(isLoanMode ? 'bills.form.error' : 'debtForm.error'));
      return;
    }
    setSaving(true);
    if (isLoanMode) {
      const categoryId = defaultCategoryId ?? SYSTEM_CATEGORY_IDS.otherExpense;
      if (getNotificationPermission() === 'default') {
        await requestNotificationPermission();
      }
      await createBill({
        name: loanName,
        amount: numericMonthlyAmount,
        dayOfMonth: loanDayOfMonth,
        firstDueDate: loanDueDate,
        categoryId,
        accountId,
        icon: mode === 'installment' ? '🎁' : '🏦',
        color: mode === 'installment' ? INSTALLMENT_COLOR : CREDIT_COLOR,
        kind: mode,
        totalAmount: numericTotalAmount,
        interestRate: numericInterestRate > 0 ? numericInterestRate : undefined,
        termMonths: numericTermMonths > 0 ? numericTermMonths : undefined,
        notifyEnabled: true,
      });
      setSaving(false);
      navigate('/bills');
      return;
    }
    await createDebt({
      personName,
      direction: mode,
      amount: numericAmount,
      date,
      dueDate: dueDate || undefined,
      note,
      linkedToBalance,
      accountId,
    });
    setSaving(false);
    navigate(-1);
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate(-1)}>
          ← {t('common.cancel')}
        </button>
        <h1>{t('debtForm.title')}</h1>
      </header>

      <div className="mode-tile-grid">
        <button type="button" className={`mode-tile${mode === 'owed_to_me' ? ' active' : ''}`} onClick={() => setMode('owed_to_me')}>
          <ArrowDownLeft size={16} strokeWidth={2.25} />
          {t('debtForm.owedToMe')}
        </button>
        <button type="button" className={`mode-tile${mode === 'i_owe' ? ' active' : ''}`} onClick={() => setMode('i_owe')}>
          <ArrowUpRight size={16} strokeWidth={2.25} />
          {t('debtForm.iOwe')}
        </button>
        <button
          type="button"
          className={`mode-tile${mode === 'credit' ? ' active' : ''}`}
          style={mode === 'credit' ? { borderColor: CREDIT_COLOR, color: CREDIT_COLOR, background: `${CREDIT_COLOR}1f` } : undefined}
          onClick={() => setMode('credit')}
        >
          <Landmark size={16} strokeWidth={2.25} />
          {t('bills.kindCredit')}
        </button>
        <button
          type="button"
          className={`mode-tile${mode === 'installment' ? ' active' : ''}`}
          style={mode === 'installment' ? { borderColor: INSTALLMENT_COLOR, color: INSTALLMENT_COLOR, background: `${INSTALLMENT_COLOR}1f` } : undefined}
          onClick={() => setMode('installment')}
        >
          <Gift size={16} strokeWidth={2.25} />
          {t('bills.kindInstallment')}
        </button>
      </div>

      {isLoanMode ? (
        <>
          <label className="field-label">{t('bills.form.totalAmountLabel')}</label>
          <AmountInput value={totalAmount} onChange={setTotalAmount} currency={settings.currency} autoFocus />

          <label className="field-label" htmlFor="loan-name">
            {t('debtForm.loanNameLabel')}
          </label>
          <input
            id="loan-name"
            type="text"
            className="text-input"
            placeholder={t('debtForm.loanNamePlaceholder')}
            value={loanName}
            onChange={(e) => setLoanName(e.target.value)}
            maxLength={60}
          />

          <p className="section-label">{t('debtForm.loanConditionsTitle')}</p>

          <div className="field-row">
            <div>
              <label className="field-label" htmlFor="loan-term">
                {t('bills.form.termMonthsLabel')}
              </label>
              <input
                id="loan-term"
                type="text"
                inputMode="numeric"
                className="text-input"
                placeholder="0"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="loan-rate">
                {t('bills.form.interestRateLabel')}
              </label>
              <input
                id="loan-rate"
                type="text"
                inputMode="decimal"
                className="text-input"
                placeholder="0"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
              />
            </div>
          </div>

          <label className="field-label">{t('bills.form.monthlyPaymentLabel')}</label>
          <AmountInput value={monthlyAmount} onChange={setMonthlyAmount} currency={settings.currency} />

          <label className="field-label" htmlFor="loan-due">
            {t('bills.nextPaymentLabel')}
          </label>
          <input id="loan-due" type="date" className="text-input" value={loanDueDate} onChange={(e) => setLoanDueDate(e.target.value)} />

          {showAccountPicker && (
            <>
              <label className="field-label">{t('debtForm.account')}</label>
              <AccountPicker value={accountId} onChange={setAccountIdOverride} />
            </>
          )}
        </>
      ) : (
        <>
          <AmountInput value={amount} onChange={setAmount} currency={settings.currency} autoFocus />

          {showAccountPicker && (
            <>
              <label className="field-label">{t('debtForm.account')}</label>
              <AccountPicker value={accountId} onChange={setAccountIdOverride} />
            </>
          )}

          <label className="field-label" htmlFor="debt-person">
            {mode === 'i_owe' ? t('debtForm.whoIOwe') : t('debtForm.whoOwesMe')}
          </label>
          <PersonPicker id="debt-person" value={personName} onChange={setPersonName} />

          <div className="field-row">
            <div>
              <label className="field-label" htmlFor="debt-date">
                {t('debtForm.dateCreated')}
              </label>
              <input id="debt-date" type="date" className="text-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="debt-due">
                {t('debtForm.dueDate')}
              </label>
              <input id="debt-due" type="date" className="text-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <label className="field-label" htmlFor="debt-note">
            {t('common.noteOptional')}
          </label>
          <input
            id="debt-note"
            type="text"
            className="text-input"
            placeholder={t('debtForm.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />

          <label className="checkbox-row">
            <input type="checkbox" checked={linkedToBalance} onChange={(e) => setLinkedToBalance(e.target.checked)} />
            <span>
              {t('debtForm.linkToBalance')}
              <small>{mode === 'i_owe' ? t('debtForm.linkHintIOwe') : t('debtForm.linkHintOwedToMe')}</small>
            </span>
          </label>
        </>
      )}

      {error && <p className="field-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={!canSave || saving} onClick={handleSave}>
        {t('common.save')}
      </button>
    </div>
  );
}
