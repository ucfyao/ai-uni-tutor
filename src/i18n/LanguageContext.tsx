'use client';

import React, { createContext, ReactNode, useContext, useSyncExternalStore } from 'react';
import { Language, TranslationKey, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKey;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'language';

function isLanguage(val: string | null): val is Language {
  return val === 'en' || val === 'zh';
}

/**
 * A tiny external store backed by localStorage so that every
 * LanguageProvider instance (and there is now only one, in layout.tsx)
 * shares the exact same language value – no useEffect race conditions.
 */
let listeners: Array<() => void> = [];

function getSnapshot(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : 'en';
}

function getServerSnapshot(): Language {
  return 'en';
}

function subscribe(listener: () => void) {
  listeners.push(listener);

  // Listen for changes from other tabs
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener('storage', onStorage);
  };
}

function setLanguageStore(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
  // Notify all subscribers in this tab
  listeners.forEach((l) => l());
}

type LanguageProviderProps = { children: ReactNode; initialLang?: Language };

export const LanguageProvider = ({ children, initialLang = 'en' }: LanguageProviderProps) => {
  const language = useSyncExternalStore(subscribe, getSnapshot, () => initialLang);

  const setLanguage = (lang: Language) => {
    setLanguageStore(lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
