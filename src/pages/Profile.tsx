import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../context/AccountContext';
import { updateEmail, updateName } from '../utils/accountAuth';

/** Профиль аккаунта — имя и почта (для восстановления пароля), вынесены с
 *  главной страницы Настроек на отдельную страницу (см. AccountSection —
 *  там только статус входа и переход сюда + выход из аккаунта). */
export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAccount();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!user) return null;

  const handleStartEditName = () => {
    setNameInput(user.name ?? '');
    setNameError(null);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    setNameBusy(true);
    setNameError(null);
    try {
      const result = await updateName(nameInput.trim());
      setUser(result);
      setEditingName(false);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : String(e));
    } finally {
      setNameBusy(false);
    }
  };

  const handleStartEditEmail = () => {
    setEmailInput(user.email ?? '');
    setEmailError(null);
    setEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    setEmailBusy(true);
    setEmailError(null);
    try {
      const result = await updateEmail(emailInput.trim());
      setUser(result);
      setEditingEmail(false);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmailBusy(false);
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

      <section className="settings-section">
        <p className="settings-hint">
          {t('userAccount.usernameLabel')}: {user.username}
        </p>

        {editingName ? (
          <>
            <label className="field-label" htmlFor="account-name-edit">
              {t('userAccount.nameLabel')}
            </label>
            <input
              id="account-name-edit"
              type="text"
              className="text-input"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={60}
            />
            {nameError && <p className="field-error">{nameError}</p>}
            <div className="sheet-footer-row">
              <button type="button" className="btn" disabled={nameBusy} onClick={() => setEditingName(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary btn-grow" disabled={nameBusy || !nameInput.trim()} onClick={handleSaveName}>
                {nameBusy ? t('userAccount.busy') : t('common.save')}
              </button>
            </div>
          </>
        ) : (
          <p className="settings-hint">
            {t('userAccount.nameLabel')}: {user.name || t('userAccount.noName')}{' '}
            <button type="button" className="btn-link" onClick={handleStartEditName}>
              {t('common.edit')}
            </button>
          </p>
        )}

        {editingEmail ? (
          <>
            <label className="field-label" htmlFor="account-email-edit">
              {t('userAccount.emailLabel')}
            </label>
            <input
              id="account-email-edit"
              type="email"
              className="text-input"
              autoFocus
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              maxLength={200}
            />
            {emailError && <p className="field-error">{emailError}</p>}
            <div className="sheet-footer-row">
              <button type="button" className="btn" disabled={emailBusy} onClick={() => setEditingEmail(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary btn-grow" disabled={emailBusy || !emailInput.trim()} onClick={handleSaveEmail}>
                {emailBusy ? t('userAccount.busy') : t('common.save')}
              </button>
            </div>
          </>
        ) : (
          <p className={user.email ? 'settings-hint' : 'settings-status settings-status--negative'}>
            {t('userAccount.emailLabel')}: {user.email || t('userAccount.noEmail')}{' '}
            <button type="button" className="btn-link" onClick={handleStartEditEmail}>
              {t('common.edit')}
            </button>
          </p>
        )}

        <p className="settings-hint">{t('userAccount.syncHint')}</p>
      </section>
    </div>
  );
}
