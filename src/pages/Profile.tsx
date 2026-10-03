import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Camera, User } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { logout, updateAvatar, updateEmail, updateName } from '../utils/accountAuth';
import { clearLocalData, pushSnapshotToServer, setSyncEnabled } from '../utils/dataSync';
import { resizeImageToDataUrl } from '../utils/imageResize';
import { ensureSeeded } from '../db/seed';

/** Профиль аккаунта — имя, почта и вся логика самого аккаунта (статус входа,
 *  выход) теперь здесь, на одной странице, а не раскидана между этой
 *  страницей и блоком в Настройках (см. git-историю AccountSection). */
export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAccount();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const latest = await updateAvatar(dataUrl);
      setUser(latest);
    } catch {
      setAvatarError(t('userAccount.avatarError'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const latest = await updateAvatar(null);
      setUser(latest);
    } catch {
      setAvatarError(t('userAccount.avatarError'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const dirty = name.trim() !== (user.name ?? '') || email.trim() !== (user.email ?? '');

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let latest = user;
      if (name.trim() !== (user.name ?? '')) {
        latest = await updateName(name.trim());
      }
      if (email.trim() !== (user.email ?? '')) {
        latest = await updateEmail(email.trim());
      }
      setUser(latest);
      setStatus(t('userAccount.profileSaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Сохраняем последние изменения на сервере перед выходом, чтобы
      // ничего не потерять — дальше локальные данные будут стёрты.
      await pushSnapshotToServer().catch(() => {});
      await logout();
      setSyncEnabled(false);
      await clearLocalData();
      await ensureSeeded();
      setUser(null);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('userAccount.profileBack')}
        </button>
        <h1>{t('userAccount.profileTitle')}</h1>
      </header>

      <div className="profile-edit-avatar-wrap">
        <button type="button" className="profile-avatar-ring profile-avatar-ring--lg profile-avatar-button" onClick={handlePickPhoto} disabled={avatarBusy}>
          <span className="profile-avatar-circle">
            {user.avatar ? <img src={user.avatar} alt="" className="profile-avatar-photo" /> : <User size={40} strokeWidth={1.75} />}
          </span>
          <span className="profile-avatar-edit-badge" aria-hidden="true">
            <Camera size={14} strokeWidth={2.25} />
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="visually-hidden" onChange={(e) => void handlePhotoSelected(e)} />
      </div>

      <div className="profile-avatar-actions">
        <button type="button" className="btn-link" disabled={avatarBusy} onClick={handlePickPhoto}>
          {avatarBusy ? t('userAccount.busy') : t('userAccount.changePhoto')}
        </button>
        {user.avatar && (
          <button type="button" className="btn-link profile-avatar-remove" disabled={avatarBusy} onClick={handleRemovePhoto}>
            {t('userAccount.removePhoto')}
          </button>
        )}
      </div>
      {avatarError && <p className="field-error">{avatarError}</p>}

      <p className="settings-status settings-status--positive">{t('userAccount.loggedInAs', { username: user.username })}</p>
      <p className="settings-hint">{t('userAccount.syncHint')}</p>

      <label className="field-label" htmlFor="profile-name">
        {t('userAccount.nameLabel')}
      </label>
      <input
        id="profile-name"
        type="text"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('userAccount.noName')}
        maxLength={60}
      />

      <label className="field-label" htmlFor="profile-username">
        {t('userAccount.usernameLabel')}
      </label>
      <input id="profile-username" type="text" className="text-input" value={user.username} disabled />
      <small className="settings-hint">{t('userAccount.usernameHint')}</small>

      <label className="field-label" htmlFor="profile-email">
        {t('userAccount.emailLabel')}
      </label>
      <input
        id="profile-email"
        type="email"
        className="text-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('userAccount.noEmail')}
        maxLength={200}
      />

      {error && <p className="field-error">{error}</p>}
      {status && <p className="settings-status settings-status--positive">{status}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={busy || !dirty || !name.trim()} onClick={handleSave}>
        {busy ? t('userAccount.busy') : t('common.save')}
      </button>

      <button type="button" className="btn btn-danger btn-block" disabled={loggingOut} onClick={handleLogout}>
        {t('userAccount.logoutButton')}
      </button>
    </div>
  );
}
