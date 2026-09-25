import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../context/SettingsContext';
import { LockScreen } from './LockScreen';
import { PIN_MIN_LENGTH } from '../utils/pin';

interface AppLockGateProps {
  children: ReactNode;
}

interface LockState {
  initialized: boolean;
  prevPinSet: boolean;
  unlocked: boolean;
}

const INITIAL_STATE: LockState = { initialized: false, prevPinSet: false, unlocked: false };

/** Гейт перед всем приложением: если включён PIN-код, при каждом свежем
 *  открытии и при возврате из фона (вкладка/приложение снова видимы) нужно
 *  ввести его заново — как обычный экран блокировки телефона. */
export function AppLockGate({ children }: AppLockGateProps) {
  const { settings, loaded } = useSettings();
  const pinSet = !!settings.pinHash;
  const [state, setState] = useState<LockState>(INITIAL_STATE);

  // Производное состояние блокировки считаем прямо при рендере (без лишнего
  // эффекта): реагируем на изменение pinSet синхронно с этим же рендером.
  if (loaded && !state.initialized) {
    setState({ initialized: true, prevPinSet: pinSet, unlocked: !pinSet });
  } else if (loaded && pinSet !== state.prevPinSet) {
    // Настройки уже были загружены, и pinSet изменился прямо во время работы
    // с приложением: если PIN только что включили — не блокируем тут же;
    // если выключили — тоже ничего скрывать не нужно (гейт и так неактивен).
    setState((s) => ({ ...s, prevPinSet: pinSet, unlocked: pinSet ? true : s.unlocked }));
  }

  useEffect(() => {
    if (!pinSet) return;
    const onVisibility = () => {
      if (document.hidden) setState((s) => ({ ...s, unlocked: false }));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pinSet]);

  if (!loaded) return null;

  if (pinSet && !state.unlocked) {
    return (
      <LockScreen
        pinLength={settings.pinLength || PIN_MIN_LENGTH}
        onUnlock={() => setState((s) => ({ ...s, unlocked: true }))}
      />
    );
  }

  return <>{children}</>;
}
