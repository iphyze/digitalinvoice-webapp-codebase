import { Link, Outlet, useLocation } from 'react-router-dom'
import { CircleCheck, LineChart, ShieldCheck } from 'lucide-react'
import Logo from '../../components/brand/Logo'
import ThemeToggle from '../../components/ui/ThemeToggle'
import styles from './AuthLayout.module.css'

// Copy from the previous app's auth layout
const HEADLINE = 'Smart invoicing. Seamless compliance.'
const VALUES = [
  { icon: ShieldCheck, text: 'Secure business access' },
  { icon: LineChart, text: 'Invoice and payment insight' },
  { icon: CircleCheck, text: 'NRS integration-ready design' },
]

/**
 * Split auth layout (approved Sample A): form on the left, navy brand panel on
 * the right with drifting light and floating product cards. Under 1024px the
 * panel is hidden and the form gets a compact logo header.
 * The form area is keyed by path, so moving between auth screens replays the entrance.
 */
export default function AuthLayout() {
  const { pathname } = useLocation()
  return (
    <main className={styles.layout}>
      <section className={styles.formSide}>
        <header className={styles.top}>
          <Link to="/" className={styles.mobileLogo} aria-label="DigitalInvoice home">
            <Logo variant="full" height={40} alt="DigitalInvoice" />
          </Link>
          <ThemeToggle />
        </header>
        <div className={`${styles.formArea} ${(pathname === '/register' || pathname === '/reset-password') ? styles.registerArea : ''}`} key={pathname}>
          <Outlet />
        </div>
      </section>

      <aside className={styles.brand} aria-label="About DigitalInvoice">
        <span className={styles.glowA} aria-hidden="true" />
        <span className={styles.glowB} aria-hidden="true" />
        <Link to="/" className={styles.brandLogo} aria-label="DigitalInvoice home">
          <Logo variant="full" tone="on-dark" height={40} alt="DigitalInvoice" />
        </Link>

        <div className={styles.copy}>
          <p className={styles.eyebrow}>Digital invoicing for Nigerian businesses</p>
          <h2 className={styles.headline}>
            <span className="sr-only">{HEADLINE}</span>
            <span aria-hidden="true">
              {HEADLINE.split(' ').map((word, i) => (
                <span key={`${word}-${i}`} className={styles.word} style={{ '--w': i }}>{word} </span>
              ))}
            </span>
          </h2>
          <p className={styles.summary}>
            Create, approve, monitor and settle invoices through one secure workspace prepared for compliant e-invoicing.
          </p>
          <ul className={styles.values}>
            {VALUES.map(({ icon: Icon, text }, i) => (
              <li key={text} className={styles.value} style={{ '--i': i }}>
                <span className={styles.valueIcon}><Icon size={17} aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative product preview (sample data) */}
        <div className={styles.cards} aria-hidden="true">
          <div className={styles.cardWrap}>
            <div className={`${styles.card} ${styles.invoice}`}>
              <div className={styles.cardHead}>
                <span className="num">INV-2026-0420</span>
                <span className={styles.badge}>Approved</span>
              </div>
              <p className={styles.cardMeta}>Adébáyọ̀ Stores · Due 30 Oct 2026</p>
              <strong className={`${styles.amount} num`}>₦1,236,250.00</strong>
              <div className={styles.bars}>
                {[38, 52, 46, 64, 58, 76, 70, 88].map((h, i) => (
                  <i key={i} style={{ '--h': `${h}%`, '--i': i }} />
                ))}
              </div>
            </div>
          </div>
          <div className={`${styles.cardWrap} ${styles.toastWrap}`}>
            <div className={`${styles.card} ${styles.toast}`}>
              <span className={styles.toastIcon}><CircleCheck size={18} aria-hidden="true" /></span>
              <div>
                <strong>Payment recorded</strong>
                <p className="num">₦1,236,250.00 received for INV-2026-0420</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}
