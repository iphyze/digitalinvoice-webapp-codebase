import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from '../../components/brand/Logo'
import Button from '../../components/ui/Button'
import ThemeToggle from '../../components/ui/ThemeToggle'
import styles from './StatusPage.module.css'

/**
 * Full-page status message (not found, access restricted…), in the same style as
 * the customer portal's "Secure link unavailable" card.
 * icon, code (small label), title, message, action { label, to }, tone ('info' | 'warning' | 'danger')
 */
export default function StatusPage({ icon: Icon, code, title, message, action, tone = 'info' }) {
  return (
    <div className={styles.page}>
      <span className={styles.glowA} aria-hidden="true" />
      <span className={styles.glowB} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink} aria-label="DigitalInvoice home"><Logo variant="full" height={38} alt="DigitalInvoice" /></Link>
        <ThemeToggle />
      </header>
      <main className={styles.main} id="main-content">
        <section className={`${styles.card} fx-enter`} data-tone={tone}>
          <span className={styles.icon}><Icon size={28} aria-hidden="true" /></span>
          {code ? <p className={`${styles.code} num`}>{code}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => window.history.back()}>Go back</Button>
            {action ? <Button size="lg" to={action.to}>{action.label}</Button> : null}
          </div>
        </section>
      </main>
    </div>
  )
}
