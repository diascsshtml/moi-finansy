import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import i18n from '../i18n';
import { db } from '../db/db';
import { SETTINGS_ID } from '../db/constants';
import type { AppLanguage, AppSettings, ThemeMode } from '../types';

interface SettingsContextValue {
  settings: AppSettings;
  /** false, пока настройки ещё не прочитаны из IndexedDB — используется,
   *  чтобы не показать на долю секунды разблокированный интерфейс до того,
   *  как станет известно, включён ли PIN-код. */
  loaded: boolean;
  isDark: boolean;
  setCurrency: (currency: string) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const DEFAULTS: AppSettings = { id: SETTINGS_ID, currency: '₸', theme: 'system', language: 'ru', onboarded: false };

const SettingsContext = createContext<SettingsContextValue | null>(null);

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return prefersDark;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const row = useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
  const settings = row ?? DEFAULTS;
  const loaded = row !== undefined;
  const systemDark = useSystemPrefersDark();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') root.setAttribute('data-theme', 'light');
    else if (settings.theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }, [settings.theme]);

  useEffect(() => {
    if (i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loaded,
      isDark,
      setCurrency: async (currency) => {
        await db.settings.update(SETTINGS_ID, { currency });
      },
      setTheme: async (theme) => {
        await db.settings.update(SETTINGS_ID, { theme });
      },
      setLanguage: async (language) => {
        await db.settings.update(SETTINGS_ID, { language });
      },
      markOnboarded: async () => {
        await db.settings.update(SETTINGS_ID, { onboarded: true });
      },
    }),
    [settings, loaded, isDark],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings должен использоваться внутри SettingsProvider');
  return ctx;
}
