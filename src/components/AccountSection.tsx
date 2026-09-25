import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logout, type AuthUser } from '../utils/accountAuth';
import { clearLocalData, pushSnapshotToServer, setSyncEnabled } from '../utils/dataSync';
import { ensureSeeded } from '../db/seed';

interface AccountSectionProps {
  user: AuthUser | null;
  onUserChange: (user: AuthUser | null) => void;
}

/** Блок в Настройках: статус входа + переход к профилю (имя, почта — см.
 *  страницу Profile) и выход из аккаунта. Вход обязателен для всего
 *  приложения (см. AccountGate), так что здесь user почти всегда есть. */
export function AccountSection({ user, onUserChange }: AccountSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      // Сохраняем последние изменения на сервере перед выходом, чтобы
      // ничего не потерять — дальше локальные данные будут стёрты.
      await pushSnapshotToServer().catch(() => {});
      await logout();
      setSyncEnabled(false);
      await clearLocalData();
      await ensureSeeded();
      onUserChange(null);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <p className="settings-status settings-status--positive">{t('userAccount.loggedInAs', { username: user.username })}</p>
      <div className="sheet-footer-row">
        <button type="button" className="btn btn-secondary btn-grow" onClick={() => navigate('/settings/profile')}>
          {t('userAccount.profileButton')}
        </button>
        <button type="button" className="btn btn-danger btn-grow" disabled={busy} onClick={handleLogout}>
          {t('userAccount.logoutButton')}
        </button>
      </div>
    </>
  );
}
