import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, Bell, ChevronRight, DatabaseBackup, Fingerprint, Languages, ShieldCheck, SunMoon, Tag, Wallet } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { useAccount } from '../context/AccountContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Sheet } from '../components/Sheet';
import { clearAllBills, clearAllData, clearAllTransactions, clearBiometricCredential, setBiometricCredential } from '../db/operations';
import { exportDataToExcel } from '../utils/excelExport';
import { isBiometricSupported, registerBiometric } from '../utils/webauthn';
import { getNotificationPrefs, isPushSupported } from '../utils/pushNotifications';
import type { AppLanguage, ThemeMode } from '../types';

const CURRENCIES = ['₸', '₽', '$', '€', '₴', 'so\'m', '₺', '£'];
const LANGUAGES: Array<{ value: AppLanguage; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'kk', label: 'Қазақша' },
];

type SettingsSheet = 'currency' | 'theme' | 'language' | 'security' | 'backup' | null;

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, setCurrency, setTheme, setLanguage } = useSettings();
  const { open } = useSheet();
  const { user } = useAccount();
  const pinEnabled = !!settings.pinHash;
  const biometricEnabled = !!settings.biometricCredentialId;
  const [customCurrency, setCustomCurrency] = useState('');
  const [confirmAction, setConfirmAction] = useState<'bills' | 'transactions' | 'all' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<SettingsSheet>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);

  useEffect(() => {
    void isBiometricSupported().then(setBiometricSupported);
  }, []);

  useEffect(() => {
    if (!isPushSupported()) return;
    getNotificationPrefs()
      .then((prefs) => setNotificationsOn(prefs.dailyEnabled || prefs.billsEnabled))
      .catch(() => {});
  }, []);

  const handleEnableBiometric = async () => {
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      const label = user?.name || user?.username || 'Мои финансы';
      const credentialId = await registerBiometric(label);
      await setBiometricCredential(credentialId);
    } catch {
      setBiometricError(t('lock.biometricFailed'));
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleDisableBiometric = async () => {
    setBiometricBusy(true);
    try {
      await clearBiometricCredential();
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleExportExcel = async () => {
    await exportDataToExcel(t, settings.currency);
    setStatus(t('settings.exportedExcelStatus'));
  };

  const handleClearBills = async () => {
    await clearAllBills();
    setConfirmAction(null);
    setStatus(t('settings.clearedBillsStatus'));
  };

  const handleClearTransactions = async () => {
    await clearAllTransactions();
    setConfirmAction(null);
    setStatus(t('settings.clearedTransactionsStatus'));
  };

  const handleClearAll = async () => {
    await clearAllData();
    setConfirmAction(null);
    setStatus(t('settings.clearedStatus'));
    window.location.reload();
  };

  const themeLabel =
    settings.theme === 'system' ? t('settings.themeSystem') : settings.theme === 'light' ? t('settings.themeLight') : t('settings.themeDark');
  const languageLabel = LANGUAGES.find((l) => l.value === settings.language)?.label ?? settings.language;

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('settings.back')}
        </button>
        <h1>{t('settings.title')}</h1>
      </header>

      <p className="section-label">{t('settings.generalSection')}</p>
      <div className="grouped-list">
        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('currency')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Banknote size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.currency')}</span>
            <span className="grouped-list-hint">{t('settings.currencyHint')}</span>
          </span>
          <span className="grouped-list-trailing">{settings.currency}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>

        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('language')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Languages size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.language')}</span>
            <span className="grouped-list-hint">{t('settings.languageHint')}</span>
          </span>
          <span className="grouped-list-trailing">{languageLabel}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>

        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('theme')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <SunMoon size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.appearance')}</span>
            <span className="grouped-list-hint">{t('settings.appearanceHint')}</span>
          </span>
          <span className="grouped-list-trailing">{themeLabel}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>
      </div>

      <p className="section-label">{t('settings.securitySection')}</p>
      <div className="grouped-list">
        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('security')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <ShieldCheck size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('lock.section')}</span>
            <span className="grouped-list-hint">{t('lock.sectionHint')}</span>
          </span>
          <span className="grouped-list-trailing">{pinEnabled ? t('common.on') : t('common.off')}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>
      </div>

      <p className="section-label">{t('settings.notificationsSection')}</p>
      <div className="grouped-list">
        <Link to="/settings/notifications" className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <Bell size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.notificationsLink')}</span>
            <span className="grouped-list-hint">{t('settings.notificationsLinkHint')}</span>
          </span>
          <span className="grouped-list-trailing">{notificationsOn ? t('common.on') : t('common.off')}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>
      </div>

      <p className="section-label">{t('settings.dataSection')}</p>
      <div className="grouped-list">
        <Link to="/settings/categories" className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <Tag size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.categoriesSection')}</span>
            <span className="grouped-list-hint">{t('settings.categoriesLink')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>

        <Link to="/settings/accounts" className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <Wallet size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.accountsSection')}</span>
            <span className="grouped-list-hint">{t('settings.accountsLink')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>

        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('backup')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <DatabaseBackup size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.backupRow')}</span>
            <span className="grouped-list-hint">{t('settings.backupHint')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>
      </div>

      <p className="settings-about">{t('settings.about')}</p>

      {activeSheet === 'currency' && (
        <Sheet title={t('settings.currency')} onClose={() => setActiveSheet(null)}>
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
        </Sheet>
      )}

      {activeSheet === 'language' && (
        <Sheet title={t('settings.language')} onClose={() => setActiveSheet(null)}>
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
        </Sheet>
      )}

      {activeSheet === 'theme' && (
        <Sheet title={t('settings.appearance')} onClose={() => setActiveSheet(null)}>
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
        </Sheet>
      )}

      {activeSheet === 'security' && (
        <Sheet title={t('lock.section')} onClose={() => setActiveSheet(null)}>
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

              {biometricSupported && (
                <>
                  <div className="settings-divider" />
                  <p className="settings-hint">
                    <Fingerprint size={14} className="inline-icon" /> {t('lock.biometricHint')}
                  </p>
                  {biometricEnabled ? (
                    <>
                      <p className="settings-status settings-status--positive">{t('lock.biometricEnabledStatus')}</p>
                      <button type="button" className="btn btn-danger btn-block" disabled={biometricBusy} onClick={handleDisableBiometric}>
                        {t('lock.biometricDisableButton')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-block" disabled={biometricBusy} onClick={handleEnableBiometric}>
                      {t('lock.biometricEnableButton')}
                    </button>
                  )}
                  {biometricError && <p className="field-error">{biometricError}</p>}
                </>
              )}
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => open({ kind: 'pin-setup', mode: 'create' })}>
              {t('lock.enableButton')}
            </button>
          )}
        </Sheet>
      )}

      {activeSheet === 'backup' && (
        <Sheet title={t('settings.backupRow')} onClose={() => setActiveSheet(null)}>
          <p className="settings-hint">{t('settings.dataHint')}</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleExportExcel}>
            {t('settings.exportExcelButton')}
          </button>
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmAction('bills')}>
            {t('settings.clearBillsButton')}
          </button>
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmAction('transactions')}>
            {t('settings.clearTransactionsButton')}
          </button>
          <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmAction('all')}>
            {t('settings.clearButton')}
          </button>
          {status && <p className="settings-status">{status}</p>}
        </Sheet>
      )}

      {confirmAction === 'bills' && (
        <ConfirmDialog
          title={t('settings.clearBillsTitle')}
          message={t('settings.clearBillsMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleClearBills}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'transactions' && (
        <ConfirmDialog
          title={t('settings.clearTransactionsTitle')}
          message={t('settings.clearTransactionsMessage')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={handleClearTransactions}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'all' && (
        <ConfirmDialog
          title={t('settings.clearAllTitle')}
          message={t('settings.clearAllMessage')}
          confirmLabel={t('settings.clearAllConfirm')}
          danger
          onConfirm={handleClearAll}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
