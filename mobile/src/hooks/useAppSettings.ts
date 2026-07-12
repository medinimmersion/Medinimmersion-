import { create } from 'zustand';
import { ThemeName, LanguageCode, themes, defaultTheme, defaultLanguage } from '../theme/themes';
import translations from '../i18n/translations.json';

interface AppSettingsStore {
  language: LanguageCode;
  theme: ThemeName;
  notifications: boolean;
  audioEnabled: boolean;

  // Actions
  setLanguage: (lang: LanguageCode) => void;
  setTheme: (theme: ThemeName) => void;
  setNotifications: (enabled: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;

  // Getters
  t: (key: string) => string;
  getTheme: () => typeof themes.medinimmersion;
}

export const useAppSettings = create<AppSettingsStore>((set, get) => ({
  language: defaultLanguage,
  theme: defaultTheme,
  notifications: true,
  audioEnabled: true,

  setLanguage: (lang: LanguageCode) => set({ language: lang }),

  setTheme: (theme: ThemeName) => set({ theme }),

  setNotifications: (enabled: boolean) => set({ notifications: enabled }),

  setAudioEnabled: (enabled: boolean) => set({ audioEnabled: enabled }),

  t: (key: string) => {
    const state = get();
    const keys = key.split('.');
    let value: any = translations[state.language];

    for (const k of keys) {
      value = value?.[k];
    }

    if (!value) {
      // Fallback to English if key not found
      value = translations.en;
      for (const k of keys) {
        value = value?.[k];
      }
    }

    return value || key;
  },

  getTheme: () => themes[get().theme],
}));
