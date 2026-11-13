import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import useToastStore from '../../stores/useToastStore'
import styles from './Toaster.module.css'

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }

function Toast({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info
  useEffect(() => {
    if (!toast.duration) return undefined
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])
  return (
    <div className={styles.toast} data-type={toast.type} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {toast.title ? <strong>{toast.title}</strong> : null}
        <p>{toast.message}</p>
      </div>
      <button type="button" className={styles.close} onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Renders toasts from useToastStore (showToast(message, type, title, options)). */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismissToast)
  return (
    <div className={styles.region} aria-live="polite">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />)}
    </div>
  )
}
