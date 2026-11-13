import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileCheck2, FileText, RefreshCw, WalletCards, Clock3, AlertTriangle, ShieldCheck } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import StatCard from '../../components/data/StatCard'
import reportService from '../../services/reportService'
import useAuthStore from '../../stores/useAuthStore'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission } from '../../utils/entitlements'
import { getErrorMessage } from '../../utils/httpError'
import ReportFilters from './ReportFilters'
import {
  createReportFilters, downloadReportCsv, isIsoDate, makeReportParams, readReport,
  reportCount, reportDate, reportMoney, reportPeriodError, REPORT_CSV_COLUMNS,
} from './reportModel'
import styles from './Reports.module.css'

const invoiceStatuses = ['all', 'draft', 'pending_approval', 'approved', 'rejected', 'void']
const paymentStatuses = ['all', 'received', 'partially_allocated', 'allocated', 'void']
const paymentsState = ['all', 'not_applicable', 'unpaid', 'partially_paid', 'paid']
const nrsStatuses = ['all', 'not_submitted', 'pending', 'accepted', 'rejected', 'failed']
const methods = ['', 'bank_transfer', 'cash', 'pos', 'card', 'cheque', 'other']
const labelOf = (key) => key === 'all' ? 'All statuses' : key === '' ? 'All methods'
  : key.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
const optionsOf = (values) => values.map((value) => ({ value, label: labelOf(value) }))
const kindDetails = {
  invoices: { title: 'Invoice Register', description: 'Review invoice activity, approval status, payment status and internal compliance readiness.', service: reportService.invoices, key: 'invoices', paged: true },
  payments: { title: 'Payment Register', description: 'Track customer receipts, allocation status and payment-method distribution.', service: reportService.payments, key: 'payments', paged: true },
  aging: { title: 'Receivables Aging', description: 'Monitor outstanding approved invoice balances by due-date age.', service: reportService.receivablesAging, key: 'invoices' },
  vat: { title: 'VAT Summary', description: 'Review internally billed VAT by treatment and invoice period.', service: reportService.vatSummary, key: 'invoices' },
}
const filterExtras = {
  invoices: [
    { key: 'status', label: 'Invoice status', options: optionsOf(invoiceStatuses) },
    { key: 'payment_status', label: 'Payment status', options: optionsOf(paymentsState) },
    { key: 'nrs_submission_status', label: 'Internal NRS status', options: optionsOf(nrsStatuses) },
  ],
  payments: [
    { key: 'status', label: 'Receipt status', options: optionsOf(paymentStatuses) },
    { key: 'method', label: 'Method', options: optionsOf(methods) },
  ],
}

function columnsFor(type, canInvoice, canPayment, currency) {
  const money = (value) => <span className="num">{reportMoney(value, currency)}</span>
  const invoiceLink = (row) => canInvoice
    ? <Link to={`/app/invoices/${row.id}`} className="ref">{row.invoice_number || `Invoice #${row.id}`}</Link>
    : <strong className="ref">{row.invoice_number || `Invoice #${row.id}`}</strong>
  if (type === 'invoices') return [
    { key: 'ref', header: 'Invoice', cell: invoiceLink },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer_name_snapshot || '—' },
    { key: 'date', header: 'Date', cell: (row) => reportDate(row.invoice_date) },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'payment', header: 'Payment', cell: (row) => <StatusBadge status={row.payment_status} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => money(row.total_amount) },
    { key: 'balance', header: 'Outstanding', align: 'right', cell: (row) => money(row.balance_due) },
  ]
  if (type === 'payments') return [
    { key: 'ref', header: 'Receipt', cell: (row) => canPayment ? <Link className="ref" to={`/app/payments/${row.id}`}>{row.receipt_number || `Receipt #${row.id}`}</Link> : <strong className="ref">{row.receipt_number || `Receipt #${row.id}`}</strong> },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer_name_snapshot || '—' },
    { key: 'date', header: 'Date', cell: (row) => reportDate(row.payment_date) },
    { key: 'method', header: 'Method', cell: (row) => labelOf(row.payment_method || 'other') },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => money(row.amount) },
    { key: 'unallocated', header: 'Unallocated', align: 'right', cell: (row) => money(row.unallocated_amount) },
  ]
  if (type === 'aging') return [
    { key: 'ref', header: 'Invoice', cell: invoiceLink },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer_name_snapshot || '—' },
    { key: 'due', header: 'Due date', cell: (row) => reportDate(row.due_date) },
    { key: 'age', header: 'Days past due', align: 'right', cell: (row) => <span className="num">{row.days_past_due <= 0 ? 'Current' : reportCount(row.days_past_due)}</span> },
    { key: 'balance', header: 'Balance due', align: 'right', cell: (row) => money(row.balance_due) },
  ]
  return [
    { key: 'ref', header: 'Invoice', cell: invoiceLink },
    { key: 'customer', header: 'Customer', cell: (row) => row.customer_name_snapshot || '—' },
    { key: 'tin', header: 'Customer TIN', cell: (row) => row.customer_tin_snapshot || '—' },
    { key: 'date', header: 'Date', cell: (row) => reportDate(row.invoice_date) },
    { key: 'net', header: 'Net amount', align: 'right', cell: (row) => money(row.taxable_amount) },
    { key: 'tax', header: 'VAT', align: 'right', cell: (row) => money(row.tax_amount) },
    { key: 'gross', header: 'Gross', align: 'right', cell: (row) => money(row.total_amount) },
  ]
}

export default function ReportRegister({ type }) {
  const config = kindDetails[type]
  const permissions = useAuthStore((s) => s.permissions)
  const entitlements = useAuthStore((s) => s.entitlements)
  const canInvoice = hasPermission(permissions, 'invoices.view') && hasEntitledPermission(entitlements, 'invoices.view')
  const canPayment = hasPermission(permissions, 'payments.view') && hasEntitledPermission(entitlements, 'payments.view')
  const [draft, setDraft] = useState(() => createReportFilters())
  const [applied, setApplied] = useState(() => createReportFilters())
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const updateDraft = (update) => {
    setDraft(update)
    if (formError) setFormError('')
  }
  const apply = () => {
    const problem = type === 'aging' ? (!isIsoDate(draft.aging_date) ? 'Choose a valid aging date.' : '') : reportPeriodError(draft)
    if (problem) { setFormError(problem); return }
    setFormError('')
    setPage(1)
    setApplied({ ...draft })
    setRefresh((v) => v + 1)
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    setResult(null)
    setError('')
    config.service(makeReportParams(type, applied, page, limit)).then((response) => {
      if (active) setResult(readReport(response, type))
    }).catch((issue) => {
      if (active) setError(getErrorMessage(issue, `Unable to load ${config.title.toLowerCase()}.`))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [type, config, applied, page, limit, refresh])

  const currency = result?.currency || applied.currency
  const rows = result?.[config.key] || []
  const stats = useMemo(() => {
    const s = result?.summary
    if (!s) return []
    if (type === 'invoices') return [
      ['Invoices', reportCount(s.total_records), 'blue', FileText],
      ['Document value', reportMoney(s.total_document_value, currency), 'teal', FileCheck2],
      ['Approved value', reportMoney(s.approved_value, currency), 'green', ShieldCheck],
      ['Approved VAT', reportMoney(s.approved_tax, currency), 'violet', FileCheck2],
      ['Approved outstanding', reportMoney(s.approved_outstanding, currency), 'amber', AlertTriangle],
    ]
    if (type === 'payments') return [
      ['Receipts', reportCount(s.total_records), 'blue', FileText],
      ['Received', reportMoney(s.received_amount, currency), 'teal', WalletCards],
      ['Allocated', reportMoney(s.allocated_amount, currency), 'green', FileCheck2],
      ['Unallocated', reportMoney(s.unallocated_amount, currency), 'amber', Clock3],
      ['Voided', reportMoney(s.voided_amount, currency), 'red', AlertTriangle],
    ]
    if (type === 'aging') return [
      ['Invoices outstanding', reportCount(s.invoice_count), 'blue', FileText],
      ['Total outstanding', reportMoney(s.total_outstanding, currency), 'amber', WalletCards],
      ...[['Current', s.current], ['1–30 days', s.days_1_30], ['31–60 days', s.days_31_60], ['61–90 days', s.days_61_90], ['Over 90 days', s.days_over_90]]
        .map(([label, item]) => [label, reportMoney(item?.amount, currency), 'red', Clock3]),
    ]
    return [
      ['Approved invoices', reportCount(s.invoice_count), 'blue', FileText],
      ['Net billed', reportMoney(s.net_amount, currency), 'teal', FileCheck2],
      ['VAT billed', reportMoney(s.vat_amount, currency), 'violet', ShieldCheck],
      ['Gross billed', reportMoney(s.gross_amount, currency), 'green', WalletCards],
      ['Internal not-submitted count', reportCount(s.not_submitted_to_nrs_count), 'amber', AlertTriangle],
    ]
  }, [result, type, currency])
  const columns = useMemo(() => columnsFor(type, canInvoice, canPayment, currency), [type, canInvoice, canPayment, currency])
  const capped = !config.paged && rows.length === 200
  const note = config.paged
    ? `Export includes only the ${rows.length} records on this page; the summary covers all ${reportCount(result?.pagination?.total)} matching records.`
    : `Showing ${rows.length} detail rows${capped ? ' (backend limit: 200; more may exist)' : ''}. Summary totals cover all matching records.`
  const csvName = `digitalinvoice-${type === 'aging' ? 'receivables-aging' : type === 'vat' ? 'vat-summary' : `${type}-register`}`

  return <main className={styles.page}>
    <PageHeader eyebrow="Reports" title={config.title} description={config.description} actions={<div className={styles.actions}>
      <Button variant="secondary" size="sm" icon={RefreshCw} disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Refresh</Button>
      <Button variant="secondary" size="sm" icon={Download} disabled={!result || rows.length === 0} onClick={() => downloadReportCsv(csvName, rows, REPORT_CSV_COLUMNS[type])}>Export shown rows</Button>
    </div>} />
    <ReportFilters type={type} draft={draft} onChange={updateDraft} onApply={apply} error={formError} loading={loading} extraOptions={filterExtras[type]} />
    {error && <Alert tone="danger" title="Report unavailable">{error} <button className={styles.inlineAction} type="button" onClick={() => setRefresh((n) => n + 1)}>Try again</button></Alert>}
    {(result || loading) && <>
      <section className={styles.metrics} aria-label="Report totals">
        {loading ? Array.from({ length: 4 }, (_, i) => <StatCard key={i} icon={FileText} label="Loading report" loading />)
          : stats.map(([label, value, tone, Icon]) => <StatCard key={label} icon={Icon} label={label} value={value} tone={tone} />)}
      </section>
      <section className={styles.panel} aria-label="Report details">
        <div className={styles.panelHeading}><div><h2>{type === 'aging' ? `Current balances, aged against ${reportDate(result?.aging_date || applied.aging_date)}` : `Records · ${currency}`}</h2><p>{result ? note : 'Retrieving report records…'}</p></div></div>
        <DataTable loading={loading} columns={columns} rows={rows} minWidth={850} empty={<div className={styles.empty}><FileText size={27} aria-hidden="true" /><h3>No matching records</h3><p>Try another date, status or currency.</p></div>} />
        {Boolean(config.paged && result && Number(result.pagination?.total) > 0) && <Pagination page={page} limit={limit}
          total={Number(result.pagination.total)} totalPages={Number(result.pagination.total_pages)} noun={type === 'invoices' ? 'invoices' : 'receipts'}
          disabled={loading} onPageChange={setPage} onLimitChange={(next) => { setPage(1); setLimit(next) }} />}
      </section>
    </>}
    {result && type === 'vat' && <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Tax treatment breakdown</h2><p>Grouped from approved invoice lines, not VAT remittance records.</p></div></div>
      <DataTable rows={result.tax_treatments} rowKey={(row) => `${row.treatment}|${row.tax_code}|${row.rate_percent}`} columns={[
        { key: 'treatment', header: 'Treatment', cell: (r) => labelOf(r.treatment || 'unknown') },
        { key: 'code', header: 'Tax code', cell: (r) => r.tax_code || '—' },
        { key: 'rate', header: 'Rate', cell: (r) => `${Number(r.rate_percent || 0).toLocaleString('en-NG', { maximumFractionDigits: 4 })}%` },
        { key: 'count', header: 'Invoices', align: 'right', cell: (r) => reportCount(r.invoice_count) },
        { key: 'taxable', header: 'Taxable amount', align: 'right', cell: (r) => reportMoney(r.taxable_amount, currency) },
        { key: 'tax', header: 'Tax amount', align: 'right', cell: (r) => reportMoney(r.tax_amount, currency) },
      ]} empty={<p className={styles.smallEmpty}>No tax treatment records in this period.</p>} />
    </section>}
    {type === 'aging' && <Alert tone="info" title="Balance basis">{result?.basis_note || 'Aging uses current outstanding balances, compared to the selected date; this is not a historical aging snapshot.'}</Alert>}
    {type === 'vat' && <Alert tone="info" title="Internal VAT reporting">{result?.compliance_note || 'This is not evidence of tax remittance, NRS approval or submission.'}</Alert>}
    {type === 'invoices' && <Alert tone="info" title="Internal compliance status">The NRS status filter is a DigitalInvoice database field, not verified production clearance. Official evidence is displayed only on eligible documents.</Alert>}
  </main>
}
