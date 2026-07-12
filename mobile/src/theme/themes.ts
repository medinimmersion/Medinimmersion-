export type ThemeName = 'medinimmersion' | 'purple';
export type LanguageCode = 'fr' | 'en' | 'ar';

export interface Theme {
  name: ThemeName;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  medinimmersion: {
    name: 'medinimmersion',
    colors: {
      primary: '#d97706',        // Gold/Amber
      secondary: '#b45309',      // Dark Gold
      accent: '#f59e0b',         // Light Gold
      background: '#fffbeb',     // Cream
      surface: '#fef3c7',        // Light Gold background
      text: '#78350f',           // Dark Brown
      textSecondary: '#92400e',  // Medium Brown
      border: '#fcd34d',         // Lighter Gold
      success: '#10b981',        // Green
      warning: '#f59e0b',        // Amber
      error: '#ef4444',          // Red
    },
  },
  purple: {
    name: 'purple',
    colors: {
      primary: '#7c3aed',        // Purple
      secondary: '#6d28d9',      // Dark Purple
      accent: '#a78bfa',         // Light Purple
      background: '#f9fafb',     // Gray
      surface: '#ffffff',        // White
      text: '#111827',           // Dark Gray
      textSecondary: '#6b7280',  // Medium Gray
      border: '#e5e7eb',         // Light Gray
      success: '#10b981',        // Green
      warning: '#f59e0b',        // Amber
      error: '#ef4444',          // Red
    },
  },
};

export const defaultTheme: ThemeName = 'medinimmersion';
export const defaultLanguage: LanguageCode = 'fr';
