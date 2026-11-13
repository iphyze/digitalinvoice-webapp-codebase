import Logo from '../brand/Logo'
import styles from './PageLoader.module.css'

/**
 * Loading screen. Centred on the viewport by default (app start, route
 * changes, session check); `inline` centres it inside its container instead
 * (e.g. a panel that's loading).
 */
export default function PageLoader({ message = 'Loading…', inline = false }) {
  return (
    <div className={styles.loader} data-inline={inline || undefined} role="status" aria-live="polite">
      <div className={styles.panel}>
        <div className={styles.mark}>
          <span className={styles.halo} aria-hidden="true" />
          <span className={styles.ring} aria-hidden="true" />
          <span className={styles.logo}><Logo variant="icon" height={34} alt="" /></span>
        </div>
        <p className={styles.message}>{message}</p>
        <span className={styles.bar} aria-hidden="true"><i /></span>
      </div>
    </div>
  )
}
