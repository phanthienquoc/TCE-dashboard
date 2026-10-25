'use client';
import * as React from 'react';
import { TCE_THEMES, type ThemeName } from './theme';
const STORAGE_KEY = 'tce-theme';
const ThemeContext = React.createContext<{
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
} | null>(null);
export function ThemeProvider({
  children,
  defaultTheme = 'tce',
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}) {
  const [theme, setTheme] = React.useState<ThemeName>(defaultTheme);
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (stored && stored in TCE_THEMES) setTheme(stored);
  }, []);
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    for (const [key, value] of Object.entries(TCE_THEMES[theme].tokens))
      root.style.setProperty(`--${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`, value);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
