import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './Drawer.module.css'
import { lockPageScroll } from './scrollLock'
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
/** Accessible right drawer, with focus trap, focus restoration and scroll lock. */
export default function Drawer({ open, onClose, title, eyebrow, description, children, footer, busy = false, className = '' }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descId = useId()
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  closeRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const releaseScroll = lockPageScroll()
    const previousDrawerState = document.body.dataset.drawerOpen
    document.body.dataset.drawerOpen = 'true'
    const frame = requestAnimationFrame(() => (dialogRef.current?.querySelector('[data-autofocus]') || dialogRef.current?.querySelector(FOCUSABLE) || dialogRef.current)?.focus())
    const onKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current?.(); return }
      if (event.key !== 'Tab') return
      const nodes = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])].filter((node) => node.getClientRects().length)
      if (!nodes.length) { event.preventDefault(); dialogRef.current?.focus(); return }
      const [first, last] = [nodes[0], nodes[nodes.length - 1]]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      releaseScroll()
      if (previousDrawerState === undefined) delete document.body.dataset.drawerOpen
      else document.body.dataset.drawerOpen = previousDrawerState
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return createPortal(<div className={styles.layer}>
    <div className={styles.backdrop} onMouseDown={() => !busy && onClose?.()} />
    <aside role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} className={`${styles.drawer} ${className}`} ref={dialogRef} tabIndex={-1}>
      <header className={styles.header}><div>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{description && <p id={descId} className={styles.description}>{description}</p>}</div><button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close drawer"><X size={19} /></button></header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </aside>
  </div>, document.body)
}
