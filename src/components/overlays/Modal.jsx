import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './Modal.module.css'
import { lockPageScroll } from './scrollLock'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal dialog, rendered into document.body.
 * Focus moves inside and is trapped; Esc and the backdrop close it (unless `busy`);
 * page scrolling is locked; focus returns to the opener on close.
 *
 * open, onClose, title, eyebrow, description, footer, size ('sm' | 'md' | 'lg'), busy
 */
export default function Modal({ open, onClose, title, eyebrow, description, footer, size = 'md', busy = false, children, className = '' }) {
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

    const focusFirst = requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector('[data-autofocus]') || dialogRef.current?.querySelector(FOCUSABLE)
      ;(target || dialogRef.current)?.focus()
    })

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focusFirst)
      document.removeEventListener('keydown', onKeyDown)
      releaseScroll()
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.layer}>
      <div className={styles.backdrop} onClick={() => !busy && onClose?.()} aria-hidden="true" />
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${className}`}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {title ? <h2 id={titleId} className={styles.title}>{title}</h2> : null}
            {description ? <p id={descId} className={styles.description}>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} disabled={busy} aria-label="Close dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children ? <div className={styles.body}>{children}</div> : <div className={styles.spacer} />}
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  )
}
