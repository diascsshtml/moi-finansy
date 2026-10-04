import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, Bell, ChevronRight, DatabaseBackup, Fingerprint, Languages, Smartphone, ShieldCheck, SunMoon, Tag, Wallet } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useSheet } from '../context/SheetContext';
import { useAccount } from '../context/AccountContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Sheet } from '../components/Sheet';
import { db } from '../db/db';
import { clearAllBills, clearAllData, clearAllTransactions, clearBiometricCredential, setBiometricCredential } from '../db/operations';
import { exportDataToExcel } from '../utils/excelExport';
import { isBiometricSupported, registerBiometric } from '../utils/webauthn';
import { getNotificationPrefs, isPushSupported } from '../utils/pushNotifications';
import { accountDisplayName } from '../utils/displayName';
import { generateApplePayToken, getApplePayStatus, revokeApplePayToken, syncPendingApplePayTransactions } from '../utils/applePay';
import type { AppLanguage, ThemeMode } from '../types';

const APPLE_PAY_WEBHOOK_URL = 'https://moi-finansy.personal-finance-pwa.workers.dev/api/webhook/apple-pay';
// Ссылка iCloud на готовую команду Shortcuts (действия Get Contents of URL +
// JSON-тело уже собраны, пользователю останется только вставить свой код).
const APPLE_PAY_SHORTCUT_URL = 'https://www.icloud.com/shortcuts/51e51c6bec7e47eabbcb93f77f750739';

const CURRENCIES = ['₸', '₽', '$', '€', '₴', 'so\'m', '₺', '£'];
const LANGUAGES: Array<{ value: AppLanguage; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'kk', label: 'Қазақша' },
];

type SettingsSheet = 'currency' | 'theme' | 'language' | 'security' | 'backup' | 'applePay' | null;

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, setCurrency, setTheme, setLanguage, setApplePayAccountId } = useSettings();
  const { open } = useSheet();
  const { user } = useAccount();
  const pinEnabled = !!settings.pinHash;
  const biometricEnabled = !!settings.biometricCredentialId;
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const [customCurrency, setCustomCurrency] = useState('');
  const [confirmAction, setConfirmAction] = useState<'bills' | 'transactions' | 'all' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<SettingsSheet>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [applePayEnabled, setApplePayEnabled] = useState(false);
  const [applePayBusy, setApplePayBusy] = useState(false);
  const [applePayError, setApplePayError] = useState<string | null>(null);
  const [newApplePayToken, setNewApplePayToken] = useState<string | null>(null);
  const [applePayCopied, setApplePayCopied] = useState(false);
  const [applePayCheckStatus, setApplePayCheckStatus] = useState<string | null>(null);

  useEffect(() => {
    void isBiometricSupported().then(setBiometricSupported);
  }, []);

  useEffect(() => {
    if (!isPushSupported()) return;
    getNotificationPrefs()
      .then((prefs) => setNotificationsOn(prefs.dailyEnabled || prefs.billsEnabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getApplePayStatus()
      .then(setApplePayEnabled)
      .catch(() => {});
  }, []);

  const handleApplePayGenerate = async () => {
    setApplePayBusy(true);
    setApplePayError(null);
    try {
      const token = await generateApplePayToken();
      setNewApplePayToken(token);
      setApplePayCopied(false);
      setApplePayEnabled(true);
    } catch (e) {
      setApplePayError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplePayBusy(false);
    }
  };

  const handleApplePayRevoke = async () => {
    setApplePayBusy(true);
    setApplePayError(null);
    try {
      await revokeApplePayToken();
      setApplePayEnabled(false);
      setNewApplePayToken(null);
    } catch (e) {
      setApplePayError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplePayBusy(false);
    }
  };

  const handleApplePayCopy = async () => {
    if (!newApplePayToken) return;
    try {
      await navigator.clipboard.writeText(newApplePayToken);
      setApplePayCopied(true);
    } catch {
      // буфер обмена недоступен — токен всё равно показан на экране
    }
  };

  const handleApplePayCheckNow = async () => {
    setApplePayBusy(true);
    setApplePayError(null);
    setApplePayCheckStatus(null);
    try {
      const count = await syncPendingApplePayTransactions();
      setApplePayCheckStatus(count > 0 ? t('settings.applePay.checkNowFound', { count }) : t('settings.applePay.checkNowEmpty'));
    } catch (e) {
      setApplePayError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplePayBusy(false);
    }
  };

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

      <p className="section-label">{t('settings.integrationsSection')}</p>
      <div className="grouped-list">
        <button type="button" className="grouped-list-row" onClick={() => setActiveSheet('applePay')}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Smartphone size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('settings.applePayRow')}</span>
            <span className="grouped-list-hint">{t('settings.applePayHint')}</span>
          </span>
          <span className="grouped-list-trailing">{applePayEnabled ? t('common.on') : t('common.off')}</span>
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

      {activeSheet === 'applePay' && (
        <Sheet title={t('settings.applePay.title')} onClose={() => setActiveSheet(null)}>
          <p className="settings-hint">{t('settings.applePay.intro')}</p>

          {newApplePayToken && (
            <>
              <p className="settings-status settings-status--positive">{t('settings.applePay.tokenOnceWarning')}</p>
              <div className="field-row field-row--inline">
                <input type="text" className="text-input" readOnly value={newApplePayToken} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-ghost" onClick={handleApplePayCopy}>
                  {applePayCopied ? t('settings.applePay.copiedStatus') : t('settings.applePay.copyButton')}
                </button>
              </div>
            </>
          )}

          {applePayEnabled ? (
            <>
              {!newApplePayToken && <p className="settings-status settings-status--positive">{t('settings.applePay.enabledStatus')}</p>}

              <label className="field-label" htmlFor="apple-pay-account">
                {t('settings.applePay.accountLabel')}
              </label>
              <select
                id="apple-pay-account"
                className="text-input"
                value={settings.applePayAccountId ?? accounts?.[0]?.id ?? ''}
                onChange={(e) => void setApplePayAccountId(e.target.value)}
              >
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountDisplayName(a, t)}
                  </option>
                ))}
              </select>

              <button type="button" className="btn btn-secondary btn-block" disabled={applePayBusy} onClick={handleApplePayCheckNow}>
                {t('settings.applePay.checkNowButton')}
              </button>
              {applePayCheckStatus && <p className="settings-status">{applePayCheckStatus}</p>}

              <div className="settings-divider" />
              {APPLE_PAY_SHORTCUT_URL && (
                <>
                  <a href={APPLE_PAY_SHORTCUT_URL} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
                    {t('settings.applePay.downloadShortcutButton')}
                  </a>
                  <p className="settings-hint">{t('settings.applePay.downloadShortcutHint')}</p>
                  <div className="settings-divider" />
                </>
              )}
              <p className="settings-hint">{t('settings.applePay.setupTitle')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep1')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep2')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep3')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep3Url', { url: APPLE_PAY_WEBHOOK_URL })}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep3Method')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep3Body')}</p>
              <p className="settings-hint">{t('settings.applePay.setupStep4')}</p>

              <div className="settings-divider" />
              <div className="sheet-footer-row">
                <button type="button" className="btn btn-secondary btn-grow" disabled={applePayBusy} onClick={handleApplePayGenerate}>
                  {t('settings.applePay.regenerateButton')}
                </button>
                <button type="button" className="btn btn-danger btn-grow" disabled={applePayBusy} onClick={handleApplePayRevoke}>
                  {t('settings.applePay.disableButton')}
                </button>
              </div>
              {newApplePayToken && <small className="settings-hint">{t('settings.applePay.regenerateWarning')}</small>}
            </>
          ) : (
            <>
              <p className="settings-status">{t('settings.applePay.disabledStatus')}</p>
              <button type="button" className="btn btn-primary btn-block" disabled={applePayBusy} onClick={handleApplePayGenerate}>
                {t('settings.applePay.enableButton')}
              </button>
            </>
          )}
          {applePayError && <p className="field-error">{applePayError}</p>}
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
