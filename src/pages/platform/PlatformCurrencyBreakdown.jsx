import { WalletCards } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import { money } from './platformModel'
import styles from './PlatformAdmin.module.css'

/** Currency-specific server aggregates only; never sum amounts across currencies. */
export default function PlatformCurrencyBreakdown({ title, rows, emptyText = 'No paid amounts recorded.', note = '' }) {
  return <section className={styles.panel} aria-label={title}>
    <div className={styles.panelHeading}><div><h2>{title}</h2><p>Each amount is reported in its original currency.</p></div></div>
    {rows.length ? <div className={styles.stats}>
      {rows.map((row) => <SummaryStat key={row.currency} icon={WalletCards} label={row.currency} value={money(row.amount, row.currency)} />)}
    </div> : <p className={styles.note}>{emptyText}</p>}
    {note && <p className={styles.note}>{note}</p>}
  </section>
}
