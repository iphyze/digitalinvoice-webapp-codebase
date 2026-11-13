import { Crown } from 'lucide-react'
import Button from './Button'
import { featureLabel } from '../../utils/entitlements'
import styles from './UpgradePrompt.module.css'

/** Shown by PermissionRoute when the plan doesn't include a module. Copy from the previous app. */
export default function UpgradePrompt({ featureKey }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.icon}><Crown size={22} aria-hidden="true" /></span>
        <p className={styles.eyebrow}>{featureLabel(featureKey)}</p>
        <h1 className={styles.title}>Upgrade required</h1>
        <p className={styles.body}>
          Your workspace is active, but this module is reserved for a higher DigitalInvoice plan. Upgrade your subscription to unlock it for your team.
        </p>
        <div className={styles.actions}>
          <Button to="/subscription/plans">View plans</Button>
          <Button to="/app/dashboard" variant="secondary">Return to dashboard</Button>
        </div>
      </div>
    </div>
  )
}
