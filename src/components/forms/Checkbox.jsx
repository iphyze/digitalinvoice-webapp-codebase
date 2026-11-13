import { forwardRef, useId } from 'react'
import { Check } from 'lucide-react'
import styles from './Checkbox.module.css'

/**
 * Checkbox (native input, custom box). `label` is the main line, `description`
 * an optional supporting line; `card` renders it as a bordered tile; `error` text below.
 */
const Checkbox = forwardRef(function Checkbox({ label, description, error, card = false, id, className = '', ...inputProps }, ref) {
  const autoId = useId()
  const inputId = id || autoId
  const messageId = error ? `${inputId}-error` : undefined
  return (
    <div className={className}>
      <label htmlFor={inputId} className={styles.row} data-card={card || undefined} data-invalid={error ? '' : undefined}>
        <input ref={ref} id={inputId} type="checkbox" className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={messageId} {...inputProps} />
        <span className={styles.box} aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {description ? <span className={styles.description}>{description}</span> : null}
        </span>
      </label>
      {error ? <p id={messageId} className={styles.error} role="alert">{error}</p> : null}
    </div>
  )
})

export default Checkbox
