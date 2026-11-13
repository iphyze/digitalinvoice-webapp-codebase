import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, CircleAlert, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import DataTable from '../../components/data/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import reportService from '../../services/reportService'
import useAuthStore from '../../stores/useAuthStore'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission } from '../../utils/entitlements'
import { getErrorMessage } from '../../utils/httpError'
import { readReport, reportCount, reportDate, reportMoney } from './reportModel'
import styles from './Reports.module.css'

const checks = [
  ['tax_identification_number_captured', 'Tax identification number'],
  ['business_registration_number_captured', 'Business registration number'],
  ['compliance_profile_confirmed', 'Compliance profile confirmation'],
]
const labelStatus = (value) => String(value || 'not_configured').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
export default function ComplianceReadiness() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const permissions = useAuthStore((s) => s.permissions)
  const entitlements = useAuthStore((s) => s.entitlements)
  const canInvoices = hasPermission(permissions, 'invoices.view') && hasEntitledPermission(entitlements, 'invoices.view')
  const canSettings = hasPermission(permissions, 'organization.manage') && hasEntitledPermission(entitlements, 'organization.manage')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setResult(null)
    reportService.complianceReadiness().then((response) => {
      if (active) setResult(readReport(response, 'compliance'))
    }).catch((requestError) => {
      if (active) setError(getErrorMessage(requestError, 'Unable to load compliance readiness.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const profile = result?.profile
  const indicators = result?.readiness_indicators
  return <main className={styles.page}>
    <PageHeader eyebrow="Reports" title="Compliance Readiness" description="Review organisation profile completeness and internal NRS/MBS integration preparation."
      actions={<Button variant="secondary" size="sm" icon={RefreshCw} disabled={loading} onClick={() => setRevision((v) => v + 1)}>Refresh</Button>} />
    <Alert tone="warning" title="Not a certification or submission record">NRS/MBS live submission is not enabled. These indicators come from stored DigitalInvoice data, not from live NRS systems. They are not proof of NRS approval, licence, clearance or certification.</Alert>
    {error && <Alert tone="danger" title="Compliance report unavailable">{error} <button type="button" className={styles.inlineAction} onClick={() => setRevision((n) => n + 1)}>Try again</button></Alert>}
    {loading && <section className={styles.panel} aria-busy="true"><h2>Loading compliance indicators…</h2><p>Checking internal records.</p></section>}
    {result && <>
      <div className={styles.complianceColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Organisation checklist</h2><p>Completeness checks for NRS preparation.</p></div><Building2 size={20} aria-hidden="true" /></div>
          <ul className={styles.checkList}>
            {checks.map(([key, label]) => <li key={key}><span className={styles.checkIcon} data-ready={Boolean(indicators[key])}>{indicators[key] ? <ShieldCheck size={18} /> : <CircleAlert size={18} />}</span>
              <div><strong>{label}</strong><small>{indicators[key] ? 'Captured in organisation profile' : 'Missing or not confirmed'}</small></div>
              <StatusBadge status={indicators[key] ? 'complete' : 'incomplete'} tone={indicators[key] ? 'success' : 'warning'} />
            </li>)}
          </ul>
          {canSettings && <Button to="/app/settings/organization" size="sm" variant="secondary" icon={ArrowUpRight}>Organisation settings</Button>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Integration overview</h2><p>Values saved in the organisation's compliance profile.</p></div><ShieldX size={20} aria-hidden="true" /></div>
          <dl className={styles.definitionList}>
            <div><dt>Business</dt><dd>{profile.name || '—'}</dd></div>
            <div><dt>TIN</dt><dd className="num">{profile.tax_identification_number || 'Not captured'}</dd></div>
            <div><dt>Issuer type</dt><dd>{labelStatus(profile.issuer_type)}</dd></div>
            <div><dt>VAT registered</dt><dd>{Number(profile.is_vat_registered) === 1 ? 'Yes' : 'No / not confirmed'}</dd></div>
            <div><dt>Internal integration status</dt><dd>{labelStatus(indicators.integration_status)}</dd></div>
            <div><dt>Environment</dt><dd>{labelStatus(indicators.integration_environment)}</dd></div>
            <div><dt>External submission</dt><dd><StatusBadge status="disabled" label="Not enabled" tone="warning" /></dd></div>
          </dl>
        </section>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Approved invoice status breakdown</h2><p>Internal database statuses only; the amounts may include multiple currencies.</p></div></div>
        <DataTable rows={result.approved_invoice_submission_statuses} rowKey="nrs_submission_status" columns={[
          { key: 'status', header: 'Internal status (unverified)', cell: (r) => <StatusBadge status={r.nrs_submission_status} label={labelStatus(r.nrs_submission_status)} /> },
          { key: 'count', header: 'Invoices', cell: (r) => <strong className="num">{reportCount(r.invoice_count)}</strong> },
          { key: 'total', header: 'Recorded amounts (mixed currencies)', cell: () => 'Not combined' },
        ]} empty={<p className={styles.smallEmpty}>No approved invoices recorded yet.</p>} />
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Awaiting future external submission</h2><p>Latest 20 internally approved invoices with status “not submitted”. Not a complete backlog if more exist.</p></div></div>
        <DataTable minWidth={750} rows={result.approved_invoices_awaiting_external_submission} columns={[
          { key: 'ref', header: 'Invoice', cell: (r) => canInvoices ? <Link className="ref" to={`/app/invoices/${r.id}`}>{r.invoice_number || `Invoice #${r.id}`}</Link> : <strong className="ref">{r.invoice_number || `Invoice #${r.id}`}</strong> },
          { key: 'customer', header: 'Customer', cell: (r) => r.customer_name_snapshot || '—' },
          { key: 'tin', header: 'Customer TIN', cell: (r) => r.customer_tin_snapshot || '—' },
          { key: 'date', header: 'Date', cell: (r) => reportDate(r.invoice_date) },
          { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <strong className="num">{reportMoney(r.total_amount, r.currency)}</strong> },
        ]} empty={<p className={styles.smallEmpty}>No approved invoices are listed as awaiting external submission.</p>} />
      </section>
      <Alert tone="info" title="Report scope">{result.note || 'This report inspects local preparation only. No external API request is performed.'}</Alert>
    </>}
  </main>
}
