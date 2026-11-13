import { Link, NavLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Logo from '../brand/Logo'
import Button from '../ui/Button'
import ThemeToggle from '../ui/ThemeToggle'
import styles from './PublicHeader.module.css'

/** Header for public pages (Landing, Request demo). Moved out of Landing unchanged. */
export default function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logoLink} aria-label="DigitalInvoice NG homepage">
        <Logo variant="full" height={46} className={styles.logo} alt="DigitalInvoice NG" />
      </Link>

      <nav className={styles.desktopNav} aria-label="Main navigation">
        <NavLink to="/request-demo" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>Request demo</NavLink>
        <Link to="/login" className={styles.navLink}>Sign in</Link>
        <Button to="/register" size="lg" iconRight={ArrowRight} className={styles.navCta}>Get started</Button>
        <ThemeToggle />
      </nav>

      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        <Link to="/login" className={styles.mobileSignIn}>Sign in</Link>
        <ThemeToggle />
      </nav>
    </header>
  )
}
