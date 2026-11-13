import { forwardRef, useId } from 'react'
import styles from './TextField.module.css'
import own from './Textarea.module.css'

/** Multi-line text field with the same API and look as TextField. */
const Textarea = forwardRef(function Textarea({ label, action, hint, error, id, rows = 4, className = '', ...props }, ref) {
  const autoId = useId()
  const inputId = id || autoId
  const messageId = `${inputId}-message`
  const message = error || hint
  return (
    <div className={`${styles.field} ${className}`}>
      {label || action ? (
        <div className={styles.labelRow}>
          {label ? <label htmlFor={inputId} className={styles.label}>{label}</label> : <span />}
          {action}
        </div>
      ) : null}
      <div className={`${styles.control} ${own.control}`} data-invalid={error ? '' : undefined}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={`${styles.input} ${own.textarea}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...props}
        />
      </div>
      {message ? <p id={messageId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>{message}</p> : null}
    </div>
  )
})

export default Textarea
