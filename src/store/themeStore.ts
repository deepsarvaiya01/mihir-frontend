import { create } from 'zustand'

type Theme = 'light' | 'dark'
interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('lab_theme') as Theme | null
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {}
  return 'light'
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('lab_theme', next) } catch {}
      return { theme: next }
    }),
  setTheme: (t) => {
    try { localStorage.setItem('lab_theme', t) } catch {}
    set({ theme: t })
  },
}))
