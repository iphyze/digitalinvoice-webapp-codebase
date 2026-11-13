import { Check } from 'lucide-react'
import { getPasswordChecks } from '../../utils/validation'
import styles from './PasswordStrength.module.css'

// Same four password requirements as the previous registration form, using
// the carried-over validation helper (and no extra password policy).
const REQUIREMENTS = [
  ['length', '8+ characters'],
  ['uppercase', 'Uppercase'],
  ['number', 'Number'],
  ['special', 'Special sign'],
]

export default function PasswordStrength({ value = '' }) {
  const checks = getPasswordChecks(value)
  const score = REQUIREMENTS.filter(([key]) => checks[key]).length

  return (
    <div className={styles.wrapper} aria-label="Password strength">
      <div className={styles.summary} role="status" aria-live="polite">
        <span className={styles.meter} aria-hidden="true">
          {REQUIREMENTS.map(([key]) => (
            <span key={key} className={`${styles.segment} ${checks[key] ? styles.passed : ''}`} />
          ))}
        </span>
        <span className={styles.meterLabel}>
          {value ? `${score} of 4 requirements met` : 'Password strength'}
        </span>
      </div>
      {value ? (
        <ul className={styles.requirements} aria-label="Password requirements">
          {REQUIREMENTS.map(([key, label]) => (
            <li key={key} className={checks[key] ? styles.checkPassed : ''}>
              <Check size={12} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
