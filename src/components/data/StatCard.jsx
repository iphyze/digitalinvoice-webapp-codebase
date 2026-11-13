import Skeleton from '../ui/Skeleton'
import styles from './StatCard.module.css'

/** KPI card, using the same quiet metric language as Customers/Invoices. */
export default function StatCard({ icon: Icon, label, value, note, tone = 'blue', loading = false, className = '' }) {
  return (
    <article className={`${styles.card} ${className}`} data-tone={tone} aria-label={label} aria-busy={loading}>
      <div className={styles.top}>
        <span className={styles.icon}><Icon size={19} aria-hidden="true" /></span>
        {note ? <span className={styles.note}>{note}</span> : null}
      </div>
      <span className={styles.label}>{label}</span>
      {loading ? <Skeleton height="24px" width="75%" /> : <strong className={`${styles.value} num`}>{value}</strong>}
    </article>
  )
}
