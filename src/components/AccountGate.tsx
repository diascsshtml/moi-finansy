import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../context/AccountContext';
import { AccountAuthForm } from './AccountAuthForm';

interface AccountGateProps {
  children: ReactNode;
}

/** Экран входа/регистрации при открытии приложения — обязательный, как в
 *  большинстве обычных приложений: без входа дальше не пройти. Данные
 *  (операции, долги, счета) хранятся в аккаунте на сервере и подтягиваются
 *  при входе — см. dataSync.ts. */
export function AccountGate({ children }: AccountGateProps) {
  const { t } = useTranslation();
  const { user, loaded, setUser } = useAccount();

  if (!loaded) return null;
  if (user) return <>{children}</>;

  return (
    <div className="account-gate">
      <div className="account-gate-card">
        <div className="account-gate-icon" aria-hidden="true">
          💰
        </div>
        <h1 className="account-gate-title">{t('accountGate.title')}</h1>
        <p className="account-gate-hint">{t('accountGate.hint')}</p>

        <AccountAuthForm onSuccess={setUser} autoFocus />
      </div>
    </div>
  );
}
