'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Language, TranslationKey, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKey;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type LanguageProviderProps = { children: ReactNode; initialLang?: Language };

export const LanguageProvider = ({ children, initialLang = 'en' }: LanguageProviderProps) => {
  const [language, setLanguage] = useState<Language>(initialLang);

  // On mount, sync with localStorage (for protected routes where URL doesn't indicate language)
  useEffect(() => {
    if (!initialLang || initialLang === 'en') {
      const stored = localStorage.getItem('language');
      if (stored === 'en' || stored === 'zh') {
        setLanguage(stored);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

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
