import { useId } from 'react'
import styles from './Switch.module.css'

/**
 * On/off toggle (role="switch"), shown as a tile with label and description.
 * checked, onChange(boolean), label, description, disabled, id
 */
export default function Switch({ checked = false, onChange, label, description, disabled = false, id, className = '' }) {
  const autoId = useId()
  const switchId = id || autoId
  const descId = description ? `${switchId}-desc` : undefined
  return (
    <div className={`${styles.tile} ${className}`} data-checked={checked || undefined} data-disabled={disabled || undefined}>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        className={styles.track}
        onClick={() => onChange?.(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
      <div className={styles.text}>
        <label htmlFor={switchId} className={styles.label}>{label}</label>
        {description ? <p id={descId} className={styles.description}>{description}</p> : null}
      </div>
    </div>
  )
}
