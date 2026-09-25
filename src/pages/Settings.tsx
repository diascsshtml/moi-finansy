import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { clearAllData } from '../db/operations';
import { exportDataToExcel } from '../utils/excelExport';
import {
  isHourlyReminderSupported,
  isSubscribedToHourlyReminders,
  sendTestReminder,
  subscribeToHourlyReminders,
  unsubscribeFromHourlyReminders,
} from '../utils/pushNotifications';
import { AccountSection } from '../components/AccountSection';
import { useAccount } from '../context/AccountContext';
import type { AppLanguage, ThemeMode } from '../types';

const CURRENCIES = ['₸', '₽', '$', '€', '₴', 'so\'m', '₺', '£'];
const LANGUAGES: Array<{ value: AppLanguage; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'kk', label: 'Қазақша' },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, setCurrency, setTheme, setLanguage } = useSettings();
  const { open } = useSheet();
  const pinEnabled = !!settings.pinHash;
  const [customCurrency, setCustomCurrency] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reminderSubscribed, setReminderSubscribed] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderTestStatus, setReminderTestStatus] = useState<string | null>(null);
  const reminderSupported = isHourlyReminderSupported();
  const { user: accountUser, setUser: setAccountUser } = useAccount();

  useEffect(() => {
    if (!reminderSupported) return;
    isSubscribedToHourlyReminders().then((subscribed) => {
      setReminderSubscribed(subscribed);
      // Реальное состояние подписки в браузере важнее любой ошибки из
      // предыдущей попытки — иначе может повиснуть уже неактуальный текст
      // ошибки рядом с «Напоминания включены».
      if (subscribed) setReminderError(null);
    });
  }, [reminderSupported]);

  const handleToggleReminders = async (enable: boolean) => {
    setReminderBusy(true);
    setReminderError(null);
    try {
      if (enable) {
        await subscribeToHourlyReminders();
        setReminderSubscribed(true);
      } else {
        await unsubscribeFromHourlyReminders();
        setReminderSubscribed(false);
      }
    } catch (e) {
      setReminderError(
        e instanceof Error && e.message === 'permission-denied'
          ? t('settings.remindersPermissionDenied')
          : t('settings.remindersError'),
      );
    } finally {
      setReminderBusy(false);
    }
  };

  const handleTestReminder = async () => {
    setReminderBusy(true);
    setReminderTestStatus(null);
    try {
      await sendTestReminder();
      setReminderTestStatus(t('settings.remindersTestSent'));
    } catch (e) {
      setReminderTestStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setReminderBusy(false);
    }
  };

  const handleExportExcel = async () => {
    await exportDataToExcel(t, settings.currency);
    setStatus(t('settings.exportedExcelStatus'));
  };

  const handleClear = async () => {
    await clearAllData();
    setConfirmClear(false);
    setStatus(t('settings.clearedStatus'));
    window.location.reload();
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('settings.back')}
        </button>
        <h1>{t('settings.title')}</h1>
      </header>

      <section className="settings-section">
        <h2>{t('settings.accountSectionTitle')}</h2>
        <AccountSection user={accountUser} onUserChange={setAccountUser} />
      </section>

      <section className="settings-section">
        <h2>{t('settings.currency')}</h2>
        <div className="currency-grid">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`currency-chip${settings.currency === c ? ' selected' : ''}`}
              onClick={() => setCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="field-row field-row--inline">
          <input
            type="text"
            className="text-input"
            placeholder={t('settings.customCurrencyPlaceholder')}
            value={customCurrency}
            maxLength={6}
            onChange={(e) => setCustomCurrency(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!customCurrency.trim()}
            onClick={() => {
              setCurrency(customCurrency.trim());
              setCustomCurrency('');
            }}
          >
            {t('common.apply')}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.appearance')}</h2>
        <div className="segmented" role="tablist">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={settings.theme === mode}
              className={settings.theme === mode ? 'active' : ''}
              onClick={() => setTheme(mode)}
            >
              {mode === 'system' ? t('settings.themeSystem') : mode === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('settings.language')}</h2>
        <div className="segmented" role="tablist">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              role="tab"
              aria-selected={settings.language === lang.value}
              className={settings.language === lang.value ? 'active' : ''}
              onClick={() => setLanguage(lang.value)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>{t('lock.section')}</h2>
        <p className="settings-hint">{t('lock.sectionHint')}</p>
        {pinEnabled ? (
          <>
            <p className="settings-status settings-status--positive">{t('lock.enabledStatus')}</p>
            <div className="sheet-footer-row">
              <button type="button" className="btn btn-secondary btn-grow" onClick={() => open({ kind: 'pin-setup', mode: 'change' })}>
                {t('lock.changeButton')}
              </button>
              <button type="button" className="btn btn-danger btn-grow" onClick={() => open({ kind: 'pin-setup', mode: 'disable' })}>
                {t('lock.disableButton')}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'pin-setup', mode: 'create' })}>
            {t('lock.enableButton')}
          </button>
        )}
      </section>

      <section className="settings-section">
        <h2>{t('settings.remindersSection')}</h2>
        <p className="settings-hint">{t('settings.remindersHint')}</p>
        {!reminderSupported ? (
          <p className="settings-status">{t('settings.remindersUnsupported')}</p>
        ) : reminderSubscribed ? (
          <>
            <p className="settings-status settings-status--positive">{t('settings.remindersEnabledStatus')}</p>
            <div className="sheet-footer-row">
              <button type="button" className="btn btn-secondary btn-grow" disabled={reminderBusy} onClick={handleTestReminder}>
                {t('settings.remindersTestButton')}
              </button>
              <button type="button" className="btn btn-danger" disabled={reminderBusy} onClick={() => handleToggleReminders(false)}>
                {t('settings.remindersDisableButton')}
              </button>
            </div>
            {reminderTestStatus && <p className="settings-status">{reminderTestStatus}</p>}
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" disabled={reminderBusy} onClick={() => handleToggleReminders(true)}>
            {t('settings.remindersEnableButton')}
          </button>
        )}
        {reminderError && <p className="field-error">{reminderError}</p>}
      </section>

      <section className="settings-section">
        <h2>{t('settings.accountsSection')}</h2>
        <Link to="/settings/accounts" className="settings-link-row">
          <span>{t('settings.accountsLink')}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>
      </section>

      <section className="settings-section">
        <h2>{t('settings.categoriesSection')}</h2>
        <Link to="/settings/categories" className="settings-link-row">
          <span>{t('settings.categoriesLink')}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>
      </section>

      <section className="settings-section">
        <h2>{t('settings.dataSection')}</h2>
        <p className="settings-hint">{t('settings.dataHint')}</p>
        <button type="button" className="btn btn-secondary btn-block" onClick={handleExportExcel}>
          {t('settings.exportExcelButton')}
        </button>
        <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmClear(true)}>
          {t('settings.clearButton')}
        </button>
        {status && <p className="settings-status">{status}</p>}
      </section>

      <p className="settings-about">{t('settings.about')}</p>

      {confirmClear && (
        <ConfirmDialog
          title={t('settings.clearAllTitle')}
          message={t('settings.clearAllMessage')}
          confirmLabel={t('settings.clearAllConfirm')}
          danger
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
