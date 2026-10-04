import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, type AuthUser } from '../utils/accountAuth';
import { initSyncHooks, pushSnapshotToServer, setSyncEnabled } from '../utils/dataSync';
import { syncPendingApplePayTransactions } from '../utils/applePay';

interface AccountContextValue {
  user: AuthUser | null;
  loaded: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoaded(true);
      if (!u) return;
      // Сессия ещё действует с прошлого раза (кука жива) — включаем синхронизацию
      // и досылаем то, что успело накопиться локально (например, если приложение
      // закрыли до того, как сработала отложенная отправка, или были офлайн). Не
      // подтягиваем данные С сервера тут же — это делается только в момент явного
      // входа (см. AccountAuthForm), чтобы случайно не затереть локальные
      // изменения, которые ещё не успели уйти.
      setSyncEnabled(true);
      initSyncHooks();
      void pushSnapshotToServer().catch(() => {});
      // Платежи Apple Pay могли прийти, пока приложение было закрыто — забираем
      // их отдельно (сам push выше их не видит, они живут только на сервере,
      // пока это не выполнится). Тихо игнорируем ошибки — офлайн/нет интеграции.
      void syncPendingApplePayTransactions().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Платёж из Apple Pay может прийти, пока приложение открыто, но свёрнуто
    // (вкладка в фоне/телефон заблокирован) — чтобы не заставлять человека
    // каждый раз перезапускать приложение целиком, довытягиваем платежи при
    // каждом возврате в приложение, а не только при первой загрузке страницы.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncPendingApplePayTransactions().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user]);

  return <AccountContext.Provider value={{ user, loaded, setUser }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount должен использоваться внутри AccountProvider');
  return ctx;
}
