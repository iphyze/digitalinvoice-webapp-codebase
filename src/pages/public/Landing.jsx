import { ArrowRight, CheckCircle2, ShieldCheck, Wallet } from 'lucide-react'
import Button from '../../components/ui/Button'
import PublicHeader from '../../components/public/PublicHeader'
import styles from './Landing.module.css'

// Illustrative values from the approved landing-page concept; not live account data.
const SAMPLE_INVOICES = [
  { id: 'INV-2026-0422', amount: '₦860,000', status: 'Approved', variant: 'approved' },
  { id: 'INV-2026-0421', amount: '₦483,750', status: 'Draft', variant: 'draft' },
  { id: 'INV-2026-0420', amount: '₦1,236,250', status: 'NRS later', variant: 'pending' },
]

function WorkspacePreview() {
  return (
    <div className={`${styles.showcase} fx-enter`} style={{ '--fx-delay': '220ms', '--fx-translate-y': '20px' }}>
      <div
        className={styles.preview}
        role="img"
        aria-label="Illustrative DigitalInvoice workspace showing invoice operations, approved invoices, receivables and recent invoice statuses. These are example values, not live data."
      >
        <div className={styles.previewHeader} aria-hidden="true">
          <span>DIGITALINVOICE / OVERVIEW</span>
          <span className={styles.windowDots}><i /><i /><i /></span>
        </div>

        <div className={styles.previewIntro} aria-hidden="true">
          <span>FINANCIAL WORKSPACE</span>
          <h2>Invoice operations</h2>
          <p>Internal workflow ready</p>
        </div>

        {/* Keep space in the illustration for the two floating summary cards. */}
        <div className={styles.statsDock} aria-hidden="true" />

        <div className={styles.recent} aria-hidden="true">
          <div className={styles.recentHeader}>
            <strong>Recent invoices</strong>
            <span className={styles.placeholderControl} />
          </div>
          <div className={`${styles.tableRow} ${styles.tableHead}`}>
            <span>INVOICE</span><span>AMOUNT</span><span>STATUS</span>
          </div>
          {SAMPLE_INVOICES.map(({ id, amount, status, variant }) => (
            <div key={id} className={styles.tableRow}>
              <strong className="num">{id}</strong>
              <span className="num">{amount}</span>
              <span className={`${styles.status} ${styles[variant]}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={`${styles.floatStat} ${styles.floatApproved}`} aria-hidden="true">
        <span className={styles.floatStatLabel}><CheckCircle2 size={16} />Approved invoices</span>
        <strong className="num">₦2.84m</strong>
        <small>Current month</small>
      </div>
      <div className={`${styles.floatStat} ${styles.floatReceivables}`} aria-hidden="true">
        <span className={styles.floatStatLabel}><Wallet size={16} />Receivables</span>
        <strong className="num">₦460k</strong>
        <small>Outstanding</small>
      </div>
      <div className={styles.floatBadge} aria-hidden="true">
        <CheckCircle2 size={20} strokeWidth={2} />
        <strong>Internal workflow<br />ready</strong>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <PublicHeader />

      <main className={styles.band} id="main-content">
        <div className={styles.bandContent}>
          <section className={`${styles.copy} fx-stagger`} aria-labelledby="landing-heading">
            <p className={styles.eyebrow}>Nigeria-ready e-invoicing workspace</p>
            <h1 id="landing-heading">
              Issue smarter invoices and build a <em>compliant financial trail.</em>
            </h1>
            <p className={styles.description}>
              DigitalInvoice NG provides subscription-based invoicing, controlled approvals,
              internal payment tracking and reporting in one secure business workspace.
            </p>
            <div className={styles.actions}>
              <Button to="/register" size="lg" iconRight={ArrowRight} className={styles.primaryCta}>Start onboarding</Button>
              <Button to="/request-demo" size="lg" variant="secondary" className={styles.secondaryCta}>Request a demo</Button>
            </div>
            <ul className={styles.trust} aria-label="Platform foundations">
              <li><ShieldCheck size={16} aria-hidden="true" /> Secured sessions</li>
              <li><CheckCircle2 size={16} aria-hidden="true" /> Compliance-ready architecture</li>
            </ul>
          </section>
          <WorkspacePreview />
        </div>
      </main>
      <footer className={styles.footer}>
        <span>DigitalInvoice NG</span>
        <span>Smart invoicing. Seamless compliance.</span>
      </footer>
    </div>
  )
}
