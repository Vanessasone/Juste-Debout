/**
 * Système de thème — mode Système / Clair / Sombre, mémorisé.
 * useColors() renvoie les couleurs actives ; useThemeMode() gère le réglage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, ThemeColors } from '@/constants/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
type Scheme = 'light' | 'dark';

type ThemeState = {
  mode: ThemeMode;
  scheme: Scheme;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
};

const STORAGE_KEY = 'jd_theme_mode';

const ThemeContext = createContext<ThemeState>({
  mode: 'system',
  scheme: 'dark',
  colors: darkColors,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  };

  const value = useMemo<ThemeState>(() => {
    const scheme: Scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
    return { mode, scheme, colors: scheme === 'light' ? lightColors : darkColors, setMode };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useColors = (): ThemeColors => useContext(ThemeContext).colors;
export const useThemeMode = () => useContext(ThemeContext);
