import { ChartNoAxesCombined } from 'lucide-react'
import styles from './SummaryStat.module.css'

/** Compact metric card for registers, platform screens and workspace insights.
 * Values remain supplied by the calling page; this component is presentation-only.
 */
export default function SummaryStat({ icon: Icon = ChartNoAxesCombined, label, value, note, tone = 'blue', className = '' }) {
  return (
    <div className={`${styles.card} ${className}`.trim()} data-tone={tone}>
      <span className={styles.icon} aria-hidden="true"><Icon size={19} strokeWidth={1.9} /></span>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        <strong className={`${styles.value} num`}>{value}</strong>
        {note ? <small className={styles.note}>{note}</small> : null}
      </div>
    </div>
  )
}
