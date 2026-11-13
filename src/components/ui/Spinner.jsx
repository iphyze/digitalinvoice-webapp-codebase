import styles from './Spinner.module.css'

export default function Spinner({ size = 18, className = '', label }) {
  return (
    <span className={`${styles.spinner} ${className}`} style={{ width: size, height: size }} role={label ? 'status' : undefined}>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
