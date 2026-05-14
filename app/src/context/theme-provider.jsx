import { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, updateSettings } from '@/lib/settings';

const ThemeContext = createContext({ theme: 'system', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getSettings().theme || 'system');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.classList.add(resolved);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    updateSettings({ theme: newTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
