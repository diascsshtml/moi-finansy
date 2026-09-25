import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, type AuthUser } from '../utils/accountAuth';
import { initSyncHooks, pushSnapshotToServer, setSyncEnabled } from '../utils/dataSync';

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
    });
  }, []);

  return <AccountContext.Provider value={{ user, loaded, setUser }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount должен использоваться внутри AccountProvider');
  return ctx;
}
