import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronRight, Code2, Download, Handshake, Info, SlidersHorizontal, User } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAccount } from '../context/AccountContext';
import { Sheet } from '../components/Sheet';
import { exportDataToExcel } from '../utils/excelExport';

const SUPPORT_EMAIL = 'kadyrbekdias123@gmail.com';

export function ProfileHub() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user } = useAccount();
  const [showAbout, setShowAbout] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExport = async () => {
    await exportDataToExcel(t, settings.currency);
    setExportStatus(t('profileHub.exportedStatus'));
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-icon-row">
          <span className="page-header-icon" aria-hidden="true">
            <User size={19} strokeWidth={2.25} />
          </span>
          <h1>{t('profileHub.title')}</h1>
        </div>
      </header>

      <div className="profile-card">
        <div className="profile-card-top">
          <span className="profile-avatar-ring" aria-hidden="true">
            <span className="profile-avatar-circle">
              <User size={32} strokeWidth={1.75} />
            </span>
          </span>
          <div>
            <h2 className="profile-card-name">{user?.name || t('profileHub.addName')}</h2>
            <Link to="/settings/profile" className="btn-link">
              {t('profileHub.editProfile')} ›
            </Link>
          </div>
        </div>
      </div>

      <h2>{t('profileHub.quickActionsTitle')}</h2>
      <div className="quick-actions-grid">
        <Link to="/debts" className="quick-action-tile">
          <span className="quick-action-icon" aria-hidden="true">
            <Handshake size={17} strokeWidth={2.25} />
          </span>
          {t('profileHub.actionDebts')}
        </Link>
        <button type="button" className="quick-action-tile" onClick={handleExport}>
          <span className="quick-action-icon" aria-hidden="true">
            <Download size={17} strokeWidth={2.25} />
          </span>
          {t('profileHub.actionExport')}
        </button>
        <Link to="/stats" className="quick-action-tile">
          <span className="quick-action-icon" aria-hidden="true">
            <BarChart3 size={17} strokeWidth={2.25} />
          </span>
          {t('profileHub.actionStats')}
        </Link>
      </div>
      {exportStatus && <p className="settings-status">{exportStatus}</p>}

      <div className="grouped-list">
        <Link to="/settings/preferences" className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <SlidersHorizontal size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('profileHub.settingsTitle')}</span>
            <span className="grouped-list-hint">{t('profileHub.settingsHint')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </Link>

        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('profileHub.supportSubject'))}`} className="grouped-list-row">
          <span className="grouped-list-icon" aria-hidden="true">
            <Handshake size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('profileHub.supportTitle')}</span>
            <span className="grouped-list-hint">{t('profileHub.supportHint')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </a>

        <button type="button" className="grouped-list-row" onClick={() => setShowAbout(true)}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Info size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('profileHub.aboutTitle')}</span>
            <span className="grouped-list-hint">{t('profileHub.aboutHint')}</span>
          </span>
          <span className="grouped-list-trailing">{__APP_VERSION__}</span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>

        <button type="button" className="grouped-list-row" onClick={() => setShowDeveloper(true)}>
          <span className="grouped-list-icon" aria-hidden="true">
            <Code2 size={16} strokeWidth={2.25} />
          </span>
          <span className="grouped-list-info">
            <span className="grouped-list-name">{t('profileHub.developerTitle')}</span>
            <span className="grouped-list-hint">{t('profileHub.developerName')}</span>
          </span>
          <ChevronRight size={18} className="chevron-affordance" aria-hidden="true" />
        </button>
      </div>

      {showAbout && (
        <Sheet title={t('profileHub.aboutTitle')} onClose={() => setShowAbout(false)}>
          <p className="settings-hint">{t('profileHub.aboutSheetBody')}</p>
          <p className="settings-hint">v{__APP_VERSION__}</p>
        </Sheet>
      )}

      {showDeveloper && (
        <Sheet title={t('profileHub.developerTitle')} onClose={() => setShowDeveloper(false)}>
          <p className="settings-hint">{t('profileHub.developerName')}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-link">
            {SUPPORT_EMAIL}
          </a>
        </Sheet>
      )}
    </div>
  );
}
