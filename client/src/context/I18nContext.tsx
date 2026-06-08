import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { translations } from '../translations';
import type { TranslationKey } from '../translations';

export type UILanguage = 'en' | 'ar';

interface I18nContextProps {
  uiLanguage: UILanguage;
  language: UILanguage;
  setUiLanguage: (lang: UILanguage) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(() => {
    return (localStorage.getItem('codenames_ui_lang') as UILanguage) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('codenames_ui_lang', uiLanguage);
    document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  const t = (key: TranslationKey): string => {
    return translations[uiLanguage][key] || translations['en'][key] || key;
  };

  return (
    <I18nContext.Provider value={{ uiLanguage, language: uiLanguage, setUiLanguage, t, isRTL: uiLanguage === 'ar' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
