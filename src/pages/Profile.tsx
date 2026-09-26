import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { updateEmail, updateName } from '../utils/accountAuth';

/** Профиль аккаунта — имя и почта (для восстановления пароля), вынесены с
 *  главной страницы Настроек на отдельную страницу (см. AccountSection —
 *  там только статус входа и переход сюда + выход из аккаунта). */
export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAccount();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!user) return null;

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

  return (
    <div className="page">
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          {t('userAccount.profileBack')}
        </button>
        <h1>{t('userAccount.profileTitle')}</h1>
      </header>

      <div className="profile-edit-avatar-wrap">
        <span className="profile-avatar-ring profile-avatar-ring--lg" aria-hidden="true">
          <span className="profile-avatar-circle">
            <User size={40} strokeWidth={1.75} />
          </span>
        </span>
      </div>

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
    </div>
  );
}
