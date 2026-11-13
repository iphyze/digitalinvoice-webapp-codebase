import { create } from 'zustand'

/*
  Theme: 'light' | 'dark'. LIGHT IS THE DEFAULT: dark is used only when the
  user has chosen it (the OS setting is not followed). index.html applies the
  saved theme before first paint; this store keeps React in sync and switches.
  Storage key and format match the previous app, so users keep their choice.

  Switching (lessons from the Teecoms site):
  - `theme-instant` disables per-element colour transitions for a moment, so
    the whole page changes in one frame (fading every element separately
    freezes the page and lets gradients jump ahead of solid colours);
  - with an origin point and View Transitions support, the new theme is
    revealed as one GPU-composited circle from the toggle; otherwise instant.
*/
const KEY = 'digitalinvoice-theme'

const readStored = () => {
  try {
    const raw = localStorage.getItem(KEY)
    const theme = raw && raw.startsWith('{') ? JSON.parse(raw)?.state?.theme : raw
    return theme === 'light' || theme === 'dark' ? theme : null
  } catch {
    return null
  }
}

const setRoot = (theme) => {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#050d20' : '#f5f7fb')
}

const apply = (theme, origin) => {
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  root.classList.add('theme-instant')
  const release = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-instant')))
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!origin || reduce || typeof document.startViewTransition !== 'function') {
    setRoot(theme)
    release()
    return
  }
  const transition = document.startViewTransition(() => setRoot(theme))
  transition.ready
    .then(() => {
      const { x, y } = origin
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
  transition.finished.finally(release)
}

const useThemeStore = create((set, get) => ({
  theme: 'light',

  // Sync with what index.html applied (saved choice, otherwise light)
  init: () => {
    const theme = readStored() || 'light'
    setRoot(theme)
    set({ theme })
  },

  // origin: { x, y } point the reveal grows from (the toggle button's centre)
  setTheme: (theme, origin) => {
    apply(theme, origin)
    set({ theme })
    try {
      localStorage.setItem(KEY, JSON.stringify({ state: { theme }, version: 0 }))
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
  },

  toggleTheme: (origin) => get().setTheme(get().theme === 'dark' ? 'light' : 'dark', origin),
}))

export default useThemeStore
