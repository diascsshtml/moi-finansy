import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmPasswordReset, login, register, requestPasswordReset, type AuthUser } from '../utils/accountAuth';
import { initSyncHooks, pullSnapshotFromServer, pushSnapshotToServer, setSyncEnabled } from '../utils/dataSync';

type Mode = 'login' | 'register' | 'reset';
type ResetStep = 'request' | 'confirm';

interface AccountAuthFormProps {
  onSuccess: (user: AuthUser) => void;
  autoFocus?: boolean;
}

/** Общая форма входа/регистрации/сброса пароля — используется и на
 *  экране-шлюзе при открытии приложения (AccountGate), и в Настройках
 *  (AccountSection), чтобы не дублировать логику в двух местах.
 *  Восстановление пароля — в два шага: запрос кода на почту (request-reset),
 *  затем код из письма + новый пароль (confirm-reset), см. accountAuth.ts. */
export function AccountAuthForm({ onSuccess, autoFocus }: AccountAuthFormProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setResetStep('request');
    setError(null);
  };

  const canSubmit =
    mode === 'login'
      ? !!username.trim() && !!password
      : mode === 'register'
        ? !!name.trim() && !!username.trim() && !!password && !!email.trim()
        : resetStep === 'request'
          ? !!username.trim()
          : !!username.trim() && !!resetCode.trim() && !!password;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        const result = await register(name.trim(), username.trim(), password, email.trim());
        setSyncEnabled(true);
        initSyncHooks();
        await pushSnapshotToServer();
        onSuccess(result);
      } else if (mode === 'reset') {
        if (resetStep === 'request') {
          await requestPasswordReset(username.trim());
          setResetStep('confirm');
        } else {
          const result = await confirmPasswordReset(username.trim(), resetCode.trim(), password);
          setSyncEnabled(true);
          initSyncHooks();
          await pullSnapshotFromServer();
          onSuccess(result);
        }
      } else {
        const result = await login(username.trim(), password);
        setSyncEnabled(true);
        initSyncHooks();
        await pullSnapshotFromServer();
        onSuccess(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'reset') {
    return (
      <>
        <p className="settings-hint">{resetStep === 'request' ? t('userAccount.resetRequestHint') : t('userAccount.resetConfirmHint')}</p>

        <label className="field-label" htmlFor="auth-username">
          {t('userAccount.usernameLabel')}
        </label>
        <input
          id="auth-username"
          type="text"
          className="text-input"
          autoComplete="username"
          autoFocus={autoFocus}
          disabled={resetStep === 'confirm'}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={32}
        />

        {resetStep === 'confirm' && (
          <>
            <label className="field-label" htmlFor="auth-reset-code">
              {t('userAccount.resetCodeLabel')}
            </label>
            <input
              id="auth-reset-code"
              type="text"
              inputMode="numeric"
              className="text-input"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              maxLength={6}
            />

            <label className="field-label" htmlFor="auth-new-password">
              {t('userAccount.newPasswordLabel')}
            </label>
            <input
              id="auth-new-password"
              type="password"
              className="text-input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={200}
            />
          </>
        )}

        <button type="button" className="btn btn-primary btn-block" disabled={busy || !canSubmit} onClick={handleSubmit}>
          {busy ? t('userAccount.busy') : resetStep === 'request' ? t('userAccount.sendCodeButton') : t('userAccount.resetButton')}
        </button>

        {error && <p className="field-error">{error}</p>}

        <button type="button" className="btn-link account-gate-skip" onClick={() => switchMode('login')}>
          {t('userAccount.backToLogin')}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
          {t('userAccount.loginTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={mode === 'register' ? 'active' : ''}
          onClick={() => switchMode('register')}
        >
          {t('userAccount.registerTab')}
        </button>
      </div>

      {mode === 'register' && (
        <>
          <label className="field-label" htmlFor="auth-name">
            {t('userAccount.nameLabel')}
          </label>
          <input
            id="auth-name"
            type="text"
            className="text-input"
            autoComplete="name"
            autoFocus={autoFocus}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </>
      )}

      <label className="field-label" htmlFor="auth-username">
        {t('userAccount.usernameLabel')}
      </label>
      <input
        id="auth-username"
        type="text"
        className="text-input"
        autoComplete="username"
        autoFocus={autoFocus && mode === 'login'}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={32}
      />

      <label className="field-label" htmlFor="auth-password">
        {t('userAccount.passwordLabel')}
      </label>
      <input
        id="auth-password"
        type="password"
        className="text-input"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={200}
      />
      {mode === 'register' && <small className="settings-hint">{t('userAccount.registerHint')}</small>}

      {mode === 'register' && (
        <>
          <label className="field-label" htmlFor="auth-email">
            {t('userAccount.emailLabel')}
          </label>
          <input
            id="auth-email"
            type="email"
            className="text-input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
          <small className="settings-hint">{t('userAccount.emailHint')}</small>
        </>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={busy || !canSubmit} onClick={handleSubmit}>
        {busy ? t('userAccount.busy') : mode === 'register' ? t('userAccount.registerTab') : t('userAccount.loginTab')}
      </button>

      {error && <p className="field-error">{error}</p>}

      {mode === 'login' && (
        <button type="button" className="btn-link account-gate-skip" onClick={() => switchMode('reset')}>
          {t('userAccount.forgotPassword')}
        </button>
      )}
    </>
  );
}
