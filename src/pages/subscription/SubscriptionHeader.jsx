import { Link } from 'react-router-dom'
import Logo from '../../components/brand/Logo'
import ThemeToggle from '../../components/ui/ThemeToggle'
import SignOutAction from '../../components/auth/SignOutAction'
import styles from './Plans.module.css'

/** Compact header for the subscription pages (as in the previous app: logo + theme toggle). */
export default function SubscriptionHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logoLink} aria-label="DigitalInvoice home">
        <Logo variant="full" height={38} alt="DigitalInvoice" />
      </Link>
      <div className={styles.headerActions}>
        <ThemeToggle />
        <SignOutAction />
      </div>
    </header>
  )
}
