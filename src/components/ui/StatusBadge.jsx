import { capitalizeWords } from '../../utils/formatters'
import styles from './StatusBadge.module.css'

// Status -> tone mapping carried over from the previous app
const toneFor = (status) => {
  const value = String(status || '').toLowerCase()
  if (['active', 'approved', 'paid', 'success', 'completed'].includes(value)) return 'success'
  if (['pending', 'pending_approval', 'partially_paid', 'payment_pending', 'unpaid', 'outstanding'].includes(value)) return 'warning'
  if (['failed', 'expired', 'void', 'cancelled', 'rejected'].includes(value)) return 'danger'
  return 'neutral'
}

/** Status pill with a dot. `label` overrides the text (defaults to the capitalised status). */
export default function StatusBadge({ status, label, tone, className = '' }) {
  return (
    <span className={`${styles.badge} ${className}`} data-tone={tone || toneFor(status)}>
      {label || capitalizeWords(String(status || '').replace(/_/g, ' '))}
    </span>
  )
}
