import { ArrowLeft, Check, Lock } from 'lucide-react'
import Button from '../../../components/ui/Button'
import styles from '../Onboarding.module.css'

/** Step heading: eyebrow, title, description, and a "Saved" chip once completed. */
export function StepHeader({ icon: Icon, eyebrow, title, description, completed }) {
  return (
    <header className={styles.stepHeader}>
      <span className={styles.stepIcon}><Icon size={22} aria-hidden="true" /></span>
      <div className={styles.stepHeading}>
        <p className={styles.stepEyebrow}>{eyebrow}</p>
        <h2 className={styles.stepTitle}>{title}</h2>
        <p className={styles.stepDescription}>{description}</p>
      </div>
      {completed ? <span className={styles.savedChip}><Check size={14} aria-hidden="true" /> Saved</span> : null}
    </header>
  )
}

/** Footer: required-steps progress on the left, Back + primary action on the right. */
export function StepActions({ progressLabel, onBack, children }) {
  return (
    <footer className={styles.actions}>
      <span className={`${styles.required} num`}><Lock size={15} aria-hidden="true" />{progressLabel}</span>
      <span className={styles.grow} />
      {onBack ? <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={onBack}>Back</Button> : null}
      {children}
    </footer>
  )
}
