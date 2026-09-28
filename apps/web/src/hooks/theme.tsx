import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeCtx {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = 'glk-theme';

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemDark(): boolean {
  return (
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

export function ThemeProvider({ children, initial }: { children: ReactNode; initial?: ThemePref }) {
  const [pref, setPrefState] = useState<ThemePref>(initial ?? readStored());
  const [sysDark, setSysDark] = useState(systemDark());

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved: ResolvedTheme = pref === 'system' ? (sysDark ? 'dark' : 'light') : pref;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0e1512' : '#0f5132');
  }, [resolved]);

  const value = useMemo<ThemeCtx>(
    () => ({
      pref,
      resolved,
      setPref: (p) => {
        setPrefState(p);
        try {
          localStorage.setItem(STORAGE_KEY, p);
        } catch {
          // depolama yok — yalnız oturum boyunca geçerli
        }
      },
    }),
    [pref, resolved],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('ThemeProvider eksik');
  return c;
}
