import { Moon, Sun } from 'lucide-react'
import useThemeStore from '../../stores/useThemeStore'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ className = '' }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className={`${styles.toggle} ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      }}
    >
      {dark ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
    </button>
  )
}
