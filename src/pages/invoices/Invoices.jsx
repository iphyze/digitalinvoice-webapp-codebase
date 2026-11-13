import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Archive, CalendarDays, Clock3, Eye, FileCheck2, FileClock, FilePlus2, PencilLine, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal, WalletCards, X } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import DatePicker from '../../components/forms/DatePicker'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import invoiceService from '../../services/invoiceService'
import firsService from '../../services/firsService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { readInvoiceCollection } from '../../utils/apiPayload'
import { hasPermission } from '../../utils/permissions'
import { FIRS_READINESS_OPTIONS, INVOICE_STATUSES, invoiceReferenceLabel, paymentStatusLabel, readinessLabel, readinessTone, statusLabel, statusTone } from './invoiceListOptions'
import { invoiceQueuePresentation, readInvoiceQueue } from './invoiceQueueStatus'
import styles from './Invoices.module.css'

const readPage = (value) => Math.max(1, Math.floor(Number(value) || 1))
const readLimit = (value) => [10, 20, 50].includes(Number(value)) ? Number(value) : 10
const validOption = (options, input, fallback) => options.some((option) => option.value === input) ? input : fallback
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
const currency = (invoice) => invoice.currency || 'NGN'
const money = (amount, unit) => { try { return formatCurrency(amount, unit || 'NGN') } catch { return `${Number(amount || 0).toLocaleString('en-NG')} ${unit || ''}` } }

export default function Invoices() {
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canCreate = hasPermission(permissions, 'invoices.create')
  const canEdit = hasPermission(permissions, 'invoices.edit')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const status = validOption(INVOICE_STATUSES, params.get('status'), 'all')
  const firs = validOption(FIRS_READINESS_OPTIONS, params.get('firs_compliance'), 'all')
  const dateFrom = isDate(params.get('date_from')) ? params.get('date_from') : ''
  const dateTo = isDate(params.get('date_to')) ? params.get('date_to') : ''
  const page = readPage(params.get('page'))
  const limit = readLimit(params.get('limit'))
  const [invoices, setInvoices] = useState([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [queueSnapshot, setQueueSnapshot] = useState(null)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [queueReload, setQueueReload] = useState(0)

  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '' || (key === 'status' && value === 'all') ||
        (key === 'firs_compliance' && value === 'all') || (key === 'page' && Number(value) === 1) ||
        (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }), [setParams])

  const searchChanged = useCallback((value) => change({ search: value, page: 1 }), [change])
  const resetFilters = useCallback(() => change({ search: '', status: 'all', firs_compliance: 'all', date_from: '', date_to: '', page: 1 }), [change])
  const fromChanged = (value) => change({ date_from: value, date_to: value && dateTo && value > dateTo ? '' : dateTo, page: 1 })
  const toChanged = (value) => change({ date_to: value, page: 1 })

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    invoiceService.list({
      search: search.trim() || undefined, status,
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
      firs_compliance: firs, page, limit,
    }).then((response) => {
      if (!active) return
      const data = readInvoiceCollection(response)
      setInvoices(Array.isArray(data.invoices) ? data.invoices : [])
      setPagination(data.pagination || { total: 0, total_pages: 0 })
    }).catch((requestError) => {
      if (!active) return
      const message = getErrorMessage(requestError, 'Unable to load invoices.')
      setError(message)
      toast(message, 'error', 'Invoices unavailable')
    }).finally(() => { if (active) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [search, status, firs, dateFrom, dateTo, page, limit, reload, toast])

  // The B2C overdue count is organisation-wide and independent of invoice
  // filters/pagination. Fetch it separately so list failures never hide it.
  useEffect(() => {
    let active = true
    setQueueSnapshot(null)
    setQueueLoading(true)
    setQueueError('')
    firsService.submissionQueue().then((response) => {
      if (!active) return
      setQueueSnapshot(readInvoiceQueue(response))
    }).catch((requestError) => {
      if (!active) return
      setQueueError(getErrorMessage(requestError, 'Unable to check the reporting queue.'))
    }).finally(() => { if (active) setQueueLoading(false) })
    return () => { active = false }
  }, [queueReload, reload])

  const summary = useMemo(() => {
    const value = invoices.reduce((acc, invoice) => acc + Number(invoice.total_amount || 0), 0)
    const currencies = new Set(invoices.map(currency))
    return {
      approved: invoices.filter((invoice) => invoice.status === 'approved').length,
      pending: invoices.filter((invoice) => invoice.status === 'pending_approval').length,
      firsReady: invoices.filter((invoice) => invoice.firs_compliance_status === 'ready').length,
      value: currencies.size > 1 ? 'Mixed currencies' : money(value, invoices.length ? currency(invoices[0]) : 'NGN'),
    }
  }, [invoices])
  const stats = [
    { label: 'Total invoice records', value: Number(pagination.total) || 0, icon: FileClock, tone: 'blue' },
    { label: 'Approved on this page', value: summary.approved, icon: FileCheck2, tone: 'green' },
    { label: 'Awaiting approval on page', value: summary.pending, icon: CalendarDays, tone: 'amber' },
    { label: 'FIRS ready on page', value: summary.firsReady, icon: ShieldCheck, tone: 'violet' },
    { label: 'Page invoice value', value: summary.value, icon: WalletCards, tone: 'teal' },
  ]
  const hasFilters = Boolean(search || status !== 'all' || firs !== 'all' || dateFrom || dateTo)
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: INVOICE_STATUSES.find((option) => option.value === status)?.label || status, onRemove: () => change({ status: 'all', page: 1 }) }] : []),
    ...(firs !== 'all' ? [{ key: 'firs', label: FIRS_READINESS_OPTIONS.find((option) => option.value === firs)?.label || firs, onRemove: () => change({ firs_compliance: 'all', page: 1 }) }] : []),
  ]

  const archiveInvoice = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    try {
      await invoiceService.archive(archiveTarget.id)
      toast('Draft invoice archived safely.', 'success', 'Invoice archived')
      setArchiveTarget(null)
      setReload((count) => count + 1)
    } catch (requestError) {
      toast(getErrorMessage(requestError, 'Unable to archive invoice.'), 'error', 'Archive failed')
    } finally { setArchiving(false) }
  }
  const actions = (invoice) => {
    const ref = invoiceReferenceLabel(invoice)
    const editable = ['draft', 'rejected'].includes(invoice.status)
    return <div className={styles.rowActions}>
      <Link className={`${styles.iconAction} ${styles.viewAction}`} to={`/app/invoices/${invoice.id}`} title="View invoice" aria-label={`View ${ref}`}><Eye size={16} /></Link>
      {canEdit && editable && <>
        <Link className={styles.iconAction} to={`/app/invoices/${invoice.id}/edit`} title="Edit invoice" aria-label={`Edit ${ref}`}><PencilLine size={16} /></Link>
        <button type="button" className={`${styles.iconAction} ${styles.danger}`} onClick={() => setArchiveTarget(invoice)} title="Archive draft" aria-label={`Archive ${ref}`}><Archive size={16} /></button>
      </>}
    </div>
  }
  const badgeWorkflow = (invoice) => <StatusBadge status={invoice.status} tone={statusTone(invoice.status)} label={statusLabel(invoice.status)} />
  const badgePayment = (invoice) => <StatusBadge status={invoice.payment_status || 'unpaid'} label={paymentStatusLabel(invoice.payment_status)} />
  const badgeFirs = (invoice) => <StatusBadge status={invoice.firs_compliance_status || 'not_checked'} tone={readinessTone(invoice.firs_compliance_status)} label={readinessLabel(invoice.firs_compliance_status)} />
  const queueIndicator = (invoice) => {
    const queue = invoiceQueuePresentation(invoice, queueSnapshot, queueLoading, queueError)
    return <div className={styles.queueCell}>
      <StatusBadge label={queue.label} tone={queue.tone} />
      {queue.detail && <small>{queue.detail}</small>}
      {queue.deadline && <small className={queue.tone === 'danger' ? styles.queueDeadlineOverdue : styles.queueDeadline}>{queue.deadline}</small>}
    </div>
  }
  const columns = [
    { key: 'invoice', header: 'Invoice', width: '13%', cell: (invoice) => <div className={styles.twoLines}>
      <Link to={`/app/invoices/${invoice.id}`} className={`${styles.invoiceLink} num ref`}>{invoiceReferenceLabel(invoice)}</Link>
      <small>{invoice.firs_compliance_status === 'ready' ? 'Ready for FIRS queue' : invoice.nrs_submission_status === 'not_submitted' ? 'Internal record · NRS pending' : invoice.nrs_submission_status || 'Internal record'}</small>
    </div> },
    { key: 'customer', header: 'Customer', width: '16%', cell: (invoice) => <div className={styles.twoLines}><strong>{invoice.customer_name_snapshot || 'Unknown customer'}</strong><small className="num">{currency(invoice)}</small></div> },
    { key: 'dates', header: 'Invoice / Due date', width: '12%', cell: (invoice) => <div className={styles.twoLines}><span className="num">{formatDate(invoice.invoice_date)}</span><small>Due {formatDate(invoice.due_date)}</small></div> },
    { key: 'amount', header: 'Amount', width: '12%', cell: (invoice) => <div className={styles.twoLines}><strong className="num">{money(invoice.total_amount, currency(invoice))}</strong><small className="num">{Number(invoice.balance_due) > 0 ? `${money(invoice.balance_due, currency(invoice))} due` : '—'}</small></div> },
    { key: 'status', header: 'Workflow', width: '10%', cell: badgeWorkflow },
    { key: 'settlement', header: 'Settlement', width: '10%', cell: badgePayment },
    { key: 'firs', header: 'FIRS readiness', width: '10%', cell: badgeFirs },
    { key: 'nrsQueue', header: 'NRS local queue', width: '17%', cell: queueIndicator },
  ]
  const empty = <div className={styles.empty}>
    <FileClock size={30} aria-hidden="true" />
    <h2>{hasFilters ? 'No matching invoices' : 'Create your first invoice draft'}</h2>
    <p>{hasFilters ? 'Adjust the filters to view another invoice record.' : 'Select an active customer and your catalogue items to prepare a server-calculated invoice.'}</p>
    {!hasFilters && canCreate && <Button to="/app/invoices/new" icon={FilePlus2}>Create invoice</Button>}
  </div>

  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Sales documents" title="Invoices" description="Prepare drafts, route them for approval and monitor settlement readiness."
      actions={canCreate && <Button icon={FilePlus2} to="/app/invoices/new">New invoice</Button>} />
    <section className={styles.queueNotice}
      data-state={queueError ? 'error' : queueSnapshot?.overdueCount > 0 ? 'overdue' : 'info'}
      role={queueError || queueSnapshot?.overdueCount > 0 ? 'alert' : 'status'}
      aria-label="NRS reporting queue">
      <span className={styles.queueNoticeIcon} aria-hidden="true">
        {queueError || queueSnapshot?.overdueCount > 0 ? <AlertTriangle size={20} />
          : queueLoading ? <Clock3 size={20} /> : <ShieldAlert size={20} />}
      </span>
      <div className={styles.queueNoticeBody}>
        <strong>{queueError ? 'NRS reporting queue unavailable'
          : queueLoading ? 'Checking the NRS reporting queue…'
            : queueSnapshot.overdueCount > 0
              ? `Attention: ${queueSnapshot.overdueCount.toLocaleString('en-NG')} B2C invoice${queueSnapshot.overdueCount === 1 ? '' : 's'} past the 24-hour NRS reporting deadline`
              : 'NRS reporting queue — no overdue B2C jobs recorded'}</strong>
        <p>{queueError
          ? `The overdue count and per-invoice queue status could not be verified. ${queueError}`
          : 'This DigitalInvoice queue is offline/dry-run only: no NRS transmission or clearance is performed here. The B2C 24-hour reporting deadline continues to run.'}</p>
        {!queueError && !queueLoading && <small>The overdue count covers the whole organisation; per-invoice indicators use only the latest 100 queue records.</small>}
      </div>
      <Button size="sm" variant="secondary" icon={RefreshCw} disabled={queueLoading}
        onClick={() => setQueueReload((value) => value + 1)}>{queueError ? 'Retry queue check' : 'Refresh queue'}</Button>
    </section>
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : typeof value === 'number' ? value.toLocaleString('en-NG') : value} tone={tone} />
    ))}</div>
    <div className={styles.filters}>
      <FilterBar search={search} onSearchChange={searchChanged} placeholder="Search invoice number, customer, reference or subject..." busy={refreshing && !loading}
        filters={[
          { key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: INVOICE_STATUSES, icon: SlidersHorizontal },
          { key: 'firs', value: firs, onChange: (value) => change({ firs_compliance: value, page: 1 }), options: FIRS_READINESS_OPTIONS, icon: ShieldCheck },
        ]} chips={chips} onReset={resetFilters} />
      <div className={styles.dateFilters} aria-label="Invoice date filters">
        <div className={styles.dateField}><span>From date</span><DatePicker id="invoice-date-from" value={dateFrom} onChange={fromChanged} max={dateTo || undefined} placeholder="From date" /></div>
        <div className={styles.dateField}><span>To date</span><DatePicker id="invoice-date-to" value={dateTo} onChange={toChanged} min={dateFrom || undefined} placeholder="To date" /></div>
        {(dateFrom || dateTo) && <button className={styles.clearDates} type="button" onClick={() => change({ date_from: '', date_to: '', page: 1 })}><X size={14} /> Clear dates</button>}
      </div>
    </div>
    {error ? <div role="alert" className={styles.empty}><h2>Invoices unavailable</h2><p>{error}</p><Button onClick={() => setReload((count) => count + 1)}>Retry</Button></div> : <>
      <DataTable minWidth={1420} columns={columns} rows={invoices} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(invoice) => <>
          <div className={styles.mobileTop}><div className={styles.mobileInvoice}><Link to={`/app/invoices/${invoice.id}`}>{invoiceReferenceLabel(invoice)}</Link><small>{invoice.customer_name_snapshot || 'Unknown customer'}</small></div>{badgeWorkflow(invoice)}</div>
          <div className={styles.mobileRow}><strong className="num">{money(invoice.total_amount, currency(invoice))}</strong><span className="num">Due {formatDate(invoice.due_date)}</span></div>
          <div className={styles.mobileChips}>{badgePayment(invoice)}{badgeFirs(invoice)}</div>
          <div className={styles.mobileQueue}>{queueIndicator(invoice)}</div>
          <div className={styles.mobileFooter}><span>{formatDate(invoice.invoice_date)}</span>{actions(invoice)}</div>
        </>} />
      {!loading && invoices.length > 0 && <Pagination noun="invoices" page={page} limit={limit} total={Number(pagination.total) || 0}
        totalPages={Number(pagination.total_pages) || undefined} disabled={refreshing} onPageChange={(next) => change({ page: next })} onLimitChange={(next) => change({ page: 1, limit: next })} />}
    </>}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive invoice draft?"
      message={archiveTarget ? `Archive ${invoiceReferenceLabel(archiveTarget)}? Archived drafts are removed from your active invoice workflow.` : ''}
      confirmLabel="Archive draft" variant="secondary" loading={archiving} onConfirm={archiveInvoice}
      onClose={() => !archiving && setArchiveTarget(null)} />
  </div>
}
