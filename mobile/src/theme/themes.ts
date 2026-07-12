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
      primary: '#2d5016',        // Deep Forest Green (MédinImmersion)
      secondary: '#d97706',      // Gold/Amber
      accent: '#fbbf24',         // Light Gold
      background: '#f0fdf4',     // Very Light Green
      surface: '#dcfce7',        // Light Green
      text: '#1b4332',           // Dark Green
      textSecondary: '#40916c',  // Medium Green
      border: '#b7e4c7',         // Light Green Border
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
