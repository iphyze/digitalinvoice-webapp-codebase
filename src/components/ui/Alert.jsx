import { AlertTriangle, CheckCircle2, Clock, Info, X, XCircle } from 'lucide-react'
import styles from './Alert.module.css'

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, session: Clock }

/**
 * Inline message.
 * tone      'info' | 'success' | 'warning' | 'danger'
 * icon      override (lucide component); 'session' tone shows a clock
 * onDismiss shows a close button when provided
 */
export default function Alert({ tone = 'info', title, children, icon, onDismiss, className = '' }) {
  const Icon = icon || ICONS[tone] || Info
  const visualTone = tone === 'session' ? 'warning' : tone
  return (
    <div className={`${styles.alert} ${className}`} data-tone={visualTone} role={visualTone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title ? <strong>{title}</strong> : null}
        {children ? <div className={styles.text}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dismiss">
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
