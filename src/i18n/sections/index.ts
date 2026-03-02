import { adminTranslations } from './admin';
import { chatTranslations } from './chat';
import { commonTranslations } from './common';
import { examTranslations } from './exam';
import { knowledgeTranslations } from './knowledge';
import { landingTranslations } from './landing';
import { navTranslations } from './nav';
import { settingsTranslations } from './settings';
import { studyTranslations } from './study';

export const translations = {
  zh: {
    ...navTranslations.zh,
    ...landingTranslations.zh,
    ...chatTranslations.zh,
    ...knowledgeTranslations.zh,
    ...examTranslations.zh,
    ...studyTranslations.zh,
    ...settingsTranslations.zh,
    ...adminTranslations.zh,
    ...commonTranslations.zh,
  },
  en: {
    ...navTranslations.en,
    ...landingTranslations.en,
    ...chatTranslations.en,
    ...knowledgeTranslations.en,
    ...examTranslations.en,
    ...studyTranslations.en,
    ...settingsTranslations.en,
    ...adminTranslations.en,
    ...commonTranslations.en,
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = (typeof translations)[Language];
