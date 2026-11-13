import { AlertCircle, CheckCircle2, ClipboardCheck, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './NrsReadiness.module.css'

/** Offline schema validation only. Never an NRS acceptance/certification claim. */
export default function NrsUblReadinessPanel({ validation, title = 'NRS UBL v1.1 offline check', documentLabel = 'Invoice' }) {
  const checked = Boolean(validation)
  const issues = Array.isArray(validation?.errors) ? validation.errors : []
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings : []
  const valid = checked && validation.schema_valid === true
  return <section className={styles.panel} aria-label="NRS UBL offline validation" aria-live="polite">
    <div className={styles.heading}>
      <span className={styles.icon} data-tone={!checked ? 'neutral' : valid ? 'success' : 'danger'}>
        {!checked ? <ClipboardCheck size={20} /> : valid ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{!checked ? 'Run the readiness check to review missing NRS schema fields. No external request is made.'
          : valid ? 'Local structure and amount reconciliation passed.'
            : `${issues.length} issue${issues.length === 1 ? '' : 's'} must be corrected before future NRS submission.`}</p>
      </div>
    </div>
    <p className={styles.disclaimer}>Offline validation only · No NRS clearance, IRN issuance or live submission.</p>
    {checked && <>
      <div className={styles.counts}><span>{issues.length} blocking</span><span>{warnings.length} advisory</span></div>
      {issues.length > 0 && <div className={styles.issueGroup}><h4>Required corrections</h4><ul>{issues.map((issue, i) => <li key={`e-${i}`}><code>{issue?.field || documentLabel}</code><span>{issue?.message || 'Review this field.'}</span></li>)}</ul></div>}
      {warnings.length > 0 && <div className={styles.issueGroup}><h4>Review before sandbox testing</h4><ul>{warnings.map((issue, i) => <li key={`w-${i}`}><code>{issue?.field || documentLabel}</code><span>{issue?.message || 'Review this field.'}</span></li>)}</ul></div>}
    </>}
    <p className={styles.help}><Info size={15} aria-hidden="true"/> Correct business information in <Link to="/app/settings/organization">organisation settings</Link>, buyer details in <Link to="/app/customers">customers</Link>, and item classifications in <Link to="/app/catalogue">catalogue</Link>. NRS business and service IDs are issued by NRS.</p>
  </section>
}
