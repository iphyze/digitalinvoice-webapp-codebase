import styles from './PageHeader.module.css'

/** Reusable heading for all workspace and platform pages. The shell owns the top breadcrumbs. */
export default function PageHeader({ eyebrow, title, description, actions, children, className = '' }) {
  return <header className={`${styles.heading} ${className}`}>
    <div className={styles.copy}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
}
