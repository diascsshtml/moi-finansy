import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { addMonths, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Calendar, CalendarClock, ChevronRight, Gift, Landmark, Pencil, Percent, Wallet } from 'lucide-react';
import { AmountInput } from '../components/AmountInput';
import { PersonPicker } from '../components/PersonPicker';
import { AccountPicker } from '../components/AccountPicker';
import { useSettings } from '../context/SettingsContext';
import { createDebt, createBill } from '../db/operations';
import { dateToISO, formatDateShort, formatMoney, todayISO } from '../utils/format';
import { db } from '../db/db';
import { SYSTEM_CATEGORY_IDS } from '../db/constants';
import { CATEGORICAL_LIGHT } from '../styles/palette';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import type { DebtDirection } from '../types';

type Mode = DebtDirection | 'credit' | 'installment';

const CREDIT_COLOR = '#e5484d'; // var(--danger), захардкожен для inline-style тайла (см. .mode-tile.active)
const INSTALLMENT_COLOR = CATEGORICAL_LIGHT[1]; // тёплый оранжевый — отличает рассрочку от кредита
const AMOUNT_FIELD_ID = 'debt-amount-input';

export function NewDebtPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { direction: directionParam } = useParams<{ direction: string }>();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);

  const [mode, setMode] = useState<Mode>(() => {
    if (typeParam === 'credit' || typeParam === 'installment') return typeParam;
    return directionParam === 'owed_to_me' ? 'owed_to_me' : 'i_owe';
  });

  // Простой долг человеку — дата возникновения всегда сегодня, отдельного
  // поля для нее в этой форме нет (см. скриншот-референс — там её тоже нет).
  const date = todayISO();
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState(''); // только помогает выставить dueDate, отдельно не сохраняется
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [linkedToBalance, setLinkedToBalance] = useState(false);

  // Кредит/рассрочка — те же поля, что и на странице «Кредиты и подписки»
  // (см. NewBillFormPage), просто доступны сразу со старта «+ Долг».
  const [loanName, setLoanName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loanTermMonths, setLoanTermMonths] = useState('');
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
  const numericLoanTermMonths = Number(loanTermMonths);
  const numericMonthlyAmount = Number(monthlyAmount);
  const loanDayOfMonth = loanDueDate ? Number(loanDueDate.split('-')[2]) : 0;
  const showAccountPicker = accounts && accounts.length > 1;

  const canSave = isLoanMode
    ? loanName.trim().length > 0 && numericTotalAmount > 0 && numericMonthlyAmount > 0 && loanDayOfMonth > 0 && !!accountId
    : numericAmount > 0 && personName.trim().length > 0 && !!accountId;

  const missingHint = isLoanMode
    ? numericTotalAmount <= 0
      ? t('debtForm.hintAmount')
      : loanName.trim().length === 0
        ? t('debtForm.hintLoanName')
        : null
    : numericAmount <= 0
      ? t('debtForm.hintAmount')
      : personName.trim().length === 0
        ? t('debtForm.hintName')
        : null;

  // «Срок» — просто удобный способ выставить dueDate (сегодня + N месяцев),
  // не хранится отдельным полем. Можно и просто выбрать дату напрямую ниже.
  const handleTermMonthsChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    setTermMonths(cleaned);
    const n = Number(cleaned);
    if (n > 0) setDueDate(dateToISO(addMonths(parseISO(date), n)));
  };

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
        termMonths: numericLoanTermMonths > 0 ? numericLoanTermMonths : undefined,
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

      <p className="section-label">{t('debtForm.typeLabel')}</p>

      {!isLoanMode && (
        <div className="mode-tile-grid">
          <button type="button" className={`mode-tile${mode === 'owed_to_me' ? ' active' : ''}`} onClick={() => setMode('owed_to_me')}>
            <ArrowDownLeft size={16} strokeWidth={2.25} />
            {t('debtForm.owedToMe')}
          </button>
          <button type="button" className={`mode-tile${mode === 'i_owe' ? ' active' : ''}`} onClick={() => setMode('i_owe')}>
            <ArrowUpRight size={16} strokeWidth={2.25} />
            {t('debtForm.iOwe')}
          </button>
        </div>
      )}
      <div className="mode-tile-grid">
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

      <div className="amount-card">
        <span className="amount-card-label">{t('debtForm.amountLabel')}</span>
        <div className="amount-card-top">
          <AmountInput
            id={AMOUNT_FIELD_ID}
            value={isLoanMode ? totalAmount : amount}
            onChange={isLoanMode ? setTotalAmount : setAmount}
            currency={settings.currency}
          />
          <button type="button" className="amount-card-edit-btn" onClick={() => document.getElementById(AMOUNT_FIELD_ID)?.focus()}>
            <Pencil size={13} strokeWidth={2.25} />
            {t('debtForm.editAmount')}
          </button>
        </div>
        <div className="amount-card-divider" />
        {isLoanMode ? (
          <div className="amount-card-sub">
            <span className="amount-card-label">{t('debtForm.loanNameLabel')}</span>
            <input
              id="loan-name"
              type="text"
              className="text-input text-input--plain"
              placeholder={t('debtForm.loanNamePlaceholder')}
              value={loanName}
              onChange={(e) => setLoanName(e.target.value)}
              maxLength={60}
            />
          </div>
        ) : (
          <div className="amount-card-sub">
            <span className="amount-card-label">{mode === 'i_owe' ? t('debtForm.whoIOwe') : t('debtForm.whoOwesMe')}</span>
            <PersonPicker id="debt-person" value={personName} onChange={setPersonName} />
          </div>
        )}
      </div>

      <p className="section-label">{isLoanMode ? t('debtForm.loanConditionsTitle') : t('debtForm.conditionsTitleDebt')}</p>

      {isLoanMode ? (
        <div className="grouped-list">
          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <CalendarClock size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('debtForm.termLabel')}</span>
              <span className="grouped-list-hint">{t('debtForm.termHint')}</span>
            </span>
            <span className="grouped-list-trailing">
              {numericLoanTermMonths > 0 ? t('bills.detail.termMonthsValue', { count: numericLoanTermMonths }) : t('debtForm.notSet')}
            </span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input
              type="text"
              inputMode="numeric"
              className="condition-row-input"
              value={loanTermMonths}
              onChange={(e) => setLoanTermMonths(e.target.value.replace(/[^0-9]/g, ''))}
              aria-label={t('debtForm.termLabel')}
            />
          </label>

          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Percent size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('debtForm.rateLabel')}</span>
              <span className="grouped-list-hint">{t('debtForm.rateHint')}</span>
            </span>
            <span className="grouped-list-trailing">{numericInterestRate > 0 ? `${interestRate}%` : t('debtForm.notSetFem')}</span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input
              type="text"
              inputMode="decimal"
              className="condition-row-input"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
              aria-label={t('debtForm.rateLabel')}
            />
          </label>

          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Wallet size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('debtForm.monthlyPaymentLabel')}</span>
              <span className="grouped-list-hint">{t('debtForm.monthlyPaymentHint')}</span>
            </span>
            <span className="grouped-list-trailing">
              {numericMonthlyAmount > 0 ? formatMoney(numericMonthlyAmount, settings.currency) : t('debtForm.notSet')}
            </span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input
              type="text"
              inputMode="decimal"
              className="condition-row-input"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
              aria-label={t('debtForm.monthlyPaymentLabel')}
            />
          </label>

          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Calendar size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('bills.nextPaymentLabel')}</span>
              <span className="grouped-list-hint">{t('debtForm.nextPaymentHint')}</span>
            </span>
            <span className="grouped-list-trailing">{loanDueDate ? formatDateShort(loanDueDate) : t('debtForm.notSetFem')}</span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input
              type="date"
              className="condition-row-input"
              value={loanDueDate}
              onChange={(e) => setLoanDueDate(e.target.value)}
              aria-label={t('bills.nextPaymentLabel')}
            />
          </label>
        </div>
      ) : (
        <div className="grouped-list">
          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <CalendarClock size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('debtForm.termLabel')}</span>
              <span className="grouped-list-hint">{t('debtForm.termHint')}</span>
            </span>
            <span className="grouped-list-trailing">
              {Number(termMonths) > 0 ? t('bills.detail.termMonthsValue', { count: Number(termMonths) }) : t('debtForm.notSet')}
            </span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input
              type="text"
              inputMode="numeric"
              className="condition-row-input"
              value={termMonths}
              onChange={(e) => handleTermMonthsChange(e.target.value)}
              aria-label={t('debtForm.termLabel')}
            />
          </label>

          <label className="grouped-list-row condition-row">
            <span className="grouped-list-icon" aria-hidden="true">
              <Calendar size={16} strokeWidth={2.25} />
            </span>
            <span className="grouped-list-info">
              <span className="grouped-list-name">{t('debtForm.dueDate')}</span>
              <span className="grouped-list-hint">{t('debtForm.dueDateHint')}</span>
            </span>
            <span className="grouped-list-trailing">{dueDate ? formatDateShort(dueDate) : t('debtForm.notSetFem')}</span>
            <ChevronRight size={16} className="chevron-affordance" aria-hidden="true" />
            <input type="date" className="condition-row-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t('debtForm.dueDate')} />
          </label>
        </div>
      )}

      {showAccountPicker && (
        <>
          <label className="field-label">{t('debtForm.account')}</label>
          <AccountPicker value={accountId} onChange={setAccountIdOverride} />
        </>
      )}

      {!isLoanMode && (
        <>
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
        {t('debtForm.addButton')}
      </button>
      {!error && missingHint && (
        <p className="settings-hint" style={{ textAlign: 'center' }}>
          {missingHint}
        </p>
      )}
    </div>
  );
}
