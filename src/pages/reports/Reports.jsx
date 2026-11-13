import { Link } from 'react-router-dom'
import { ArrowUpRight, BookText, CircleGauge, FileBarChart2, FileSpreadsheet, ShieldCheck, WalletCards } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Alert from '../../components/ui/Alert'
import styles from './Reports.module.css'

const items = [
  { title: 'Invoice Register', detail: 'Review approved, draft and pending invoices by date, payment and internal NRS status.', icon: BookText, to: '/app/reports/invoices', tag: 'Sales' },
  { title: 'Payment Register', detail: 'Trace receipts, allocation balances and voided transactions by payment method.', icon: WalletCards, to: '/app/reports/payments', tag: 'Collections' },
  { title: 'Receivables Aging', detail: 'Examine outstanding approved invoices by how long they are past their due date.', icon: CircleGauge, to: '/app/reports/receivables-aging', tag: 'Receivables' },
  { title: 'Customer Statement', detail: 'Generate a running-balance statement, export it or deliver it to the customer.', icon: FileSpreadsheet, to: '/app/reports/customer-statement', tag: 'Customer accounts' },
  { title: 'VAT Summary', detail: 'View internally billed VAT and a breakdown of tax treatments on approved invoices.', icon: FileBarChart2, to: '/app/reports/vat-summary', tag: 'Tax records' },
  { title: 'Compliance Readiness', detail: 'Inspect profile readiness and approved invoices awaiting future NRS integration.', icon: ShieldCheck, to: '/app/reports/compliance-readiness', tag: 'NRS preparation' },
]

export default function Reports() {
  return <main className={styles.page}>
    <PageHeader eyebrow="Reporting centre" title="Reports" description="Financial visibility, receivables monitoring and internal compliance preparation in one place." />
    <div className={styles.hubGrid}>
      {items.map(({ title, detail, icon: Icon, to, tag }) => <Link to={to} className={`${styles.hubCard} fx-enter`} key={to}>
        <span className={styles.hubTop}><span className={styles.hubIcon}><Icon size={21} aria-hidden="true" /></span><span className={styles.hubTag}>{tag}</span></span>
        <strong>{title}</strong><p>{detail}</p><span className={styles.hubLink}>Open report <ArrowUpRight size={15} aria-hidden="true" /></span>
      </Link>)}
    </div>
    <Alert tone="info" title="Internal reporting only">These reports are generated from DigitalInvoice records. They do not establish NRS validation, tax remittance, certification or live submission.</Alert>
  </main>
}
