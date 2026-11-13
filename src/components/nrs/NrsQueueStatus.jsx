import { AlertTriangle, Clock3, RefreshCw, ShieldAlert } from 'lucide-react'
import Button from '../ui/Button'
import StatusBadge from '../ui/StatusBadge'
import { invoiceQueuePresentation } from '../../pages/invoices/invoiceQueueStatus'
import styles from './NrsReadiness.module.css'

/** Read-only local queue card. Does not imply transmission to NRS. */
export default function NrsQueueStatus({ invoice, snapshot, loading, error, onRetry }) {
  if (invoice?.status !== 'approved') return null
  const view = invoiceQueuePresentation(invoice, snapshot, loading, error)
  const isOverdue = view.label === 'B2C overdue'
  const isB2c = invoice?.firs_transaction_type === 'b2c'
  return <section className={styles.panel} aria-label="NRS reporting queue" data-overdue={isOverdue || undefined}>
    <div className={styles.queueHeader}>
      <span className={styles.icon} data-tone={isOverdue ? 'danger' : 'warning'}>{isOverdue ? <AlertTriangle size={20} /> : <Clock3 size={20} />}</span>
      <div><h3>{isB2c ? 'B2C reporting — 24-hour window' : 'B2B clearance — pending NRS access'}</h3>
        <p>{error ? `Queue unavailable: ${error}` : view.detail || (loading ? 'Checking the local queue…' : 'No individual record could be confirmed in the queue response.')}</p></div>
      <StatusBadge label={view.label} tone={view.tone} />
    </div>
    {view.deadline && <p className={styles.deadline} data-overdue={isOverdue || undefined}>{view.deadline}{isOverdue ? ' · OVERDUE — action required' : ''}</p>}
    <p className={styles.disclaimer}><ShieldAlert size={15} aria-hidden="true" /> Internal dry-run queue only: no regulatory reporting, clearance or NRS receipt. The B2C deadline continues to run.</p>
    <div className={styles.queueFooter}>
      {snapshot && <small>{snapshot.overdueCount.toLocaleString('en-NG')} overdue B2C jobs organisation-wide (not this invoice’s count).</small>}
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} loading={loading}>{error ? 'Retry queue' : 'Refresh queue'}</Button>
    </div>
  </section>
}
