import { forwardRef, useId } from 'react'
import styles from './TextField.module.css'

/**
 * Labelled text input. Works with plain state or React Hook Form (`{...register('x')}`).
 *
 * label        visible label (above the input)
 * icon         lucide-react icon shown inside the input
 * action       element on the label row's right (e.g. "Forgot password?" link)
 * trailing     element inside the input on the right (e.g. show-password button)
 * hint         helper text under the input
 * error        error text: sets aria-invalid and replaces the hint
 * size         'sm' (34px) | 'md' (42px, default) | 'lg' (50px, auth)
 */
const TextField = forwardRef(function TextField(
  { label, icon: Icon, action, trailing, hint, error, size = 'md', id, className = '', ...inputProps },
  ref,
) {
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
      <div className={styles.control} data-size={size} data-invalid={error ? '' : undefined}>
        {Icon ? <Icon size={17} className={styles.icon} aria-hidden="true" /> : null}
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...inputProps}
        />
        {trailing}
      </div>
      {message ? (
        <p id={messageId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>{message}</p>
      ) : null}
    </div>
  )
})

export default TextField
