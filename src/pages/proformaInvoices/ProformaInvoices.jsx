import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Archive, Clock3, Eye, FileCheck2, FilePlus2, FileSignature, PencilLine, SlidersHorizontal,
  WalletCards, X,
} from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import DatePicker from '../../components/forms/DatePicker'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import proformaInvoiceService from '../../services/proformaInvoiceService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import {
  PROFORMA_STATUSES, proformaCollection, proformaEditable, proformaReference, proformaStatusLabel, proformaStatusTone,
} from './proformaModel'
import styles from '../invoices/Invoices.module.css'

const positivePage = (value) => Math.max(1, Math.floor(Number(value) || 1))
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
const money = (value, currency) => {
  try { return formatCurrency(value, currency || 'NGN') }
  catch { return `${currency || 'NGN'} ${Number(value || 0).toLocaleString('en-NG')}` }
}

export default function ProformaInvoices() {
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canCreate = hasPermission(permissions, 'proformas.create')
  const canEdit = hasPermission(permissions, 'proformas.edit')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const status = PROFORMA_STATUSES.some((s) => s.value === params.get('status')) ? params.get('status') : 'all'
  const dateFrom = validDate(params.get('date_from')) ? params.get('date_from') : ''
  const dateTo = validDate(params.get('date_to')) ? params.get('date_to') : ''
  const page = positivePage(params.get('page'))
  const limit = [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 10
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)

  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '' || (key === 'status' && value === 'all') ||
        (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }), [setParams])
  const reset = useCallback(() => change({ search: '', status: 'all', date_from: '', date_to: '', page: 1 }), [change])
  const searchChanged = useCallback((value) => change({ search: value, page: 1 }), [change])
  const hasFilters = Boolean(search || status !== 'all' || dateFrom || dateTo)
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: proformaStatusLabel(status), onRemove: () => change({ status: 'all', page: 1 }) }] : []),
  ]

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    proformaInvoiceService.list({ search: search.trim() || undefined, status, date_from: dateFrom || undefined,
      date_to: dateTo || undefined, page, limit })
      .then((response) => {
        if (!active) return
        const result = proformaCollection(response)
        setRecords(result.records)
        setPagination(result.pagination)
      }).catch((requestError) => {
        if (!active) return
        setError(getErrorMessage(requestError, 'Unable to load proforma invoices.'))
        setRecords([])
      }).finally(() => { if (active) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [search, status, dateFrom, dateTo, page, limit, reload])

  const metrics = useMemo(() => {
    const currencies = new Set(records.map((row) => row.currency || 'NGN'))
    return {
      drafts: records.filter((row) => row.status === 'draft').length,
      issued: records.filter((row) => row.status === 'issued').length,
      converted: records.filter((row) => row.status === 'converted').length,
      value: currencies.size > 1 ? 'Mixed currencies' : money(records.reduce((total, row) => total + Number(row.total_amount || 0), 0), records[0]?.currency),
    }
  }, [records])
  const stats = [
    { label: 'Total matching proformas', value: pagination.total || 0, icon: FileSignature, tone: 'blue' },
    { label: 'Drafts on this page', value: metrics.drafts, icon: FilePlus2, tone: 'teal' },
    { label: 'Issued on this page', value: metrics.issued, icon: FileCheck2, tone: 'green' },
    { label: 'Converted on this page', value: metrics.converted, icon: Clock3, tone: 'amber' },
    { label: 'Page proforma value', value: metrics.value, icon: WalletCards, tone: 'violet' },
  ]
  const archive = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    try {
      await proformaInvoiceService.archive(archiveTarget.id)
      toast('Proforma draft archived successfully.', 'success', 'Draft archived')
      setArchiveTarget(null)
      setReload((value) => value + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to archive proforma.'), 'error', 'Archive failed') }
    finally { setArchiving(false) }
  }
  const badge = (record) => <StatusBadge status={record.status} label={proformaStatusLabel(record.status)} tone={proformaStatusTone(record.status)} />
  const actions = (record) => <div className={styles.rowActions}>
    <Link className={`${styles.iconAction} ${styles.viewAction}`} to={`/app/proforma-invoices/${record.id}`} title="View proforma" aria-label={`View ${proformaReference(record)}`}><Eye size={16} /></Link>
    {canEdit && proformaEditable(record) && <>
      <Link className={styles.iconAction} to={`/app/proforma-invoices/${record.id}/edit`} title="Edit draft" aria-label={`Edit ${proformaReference(record)}`}><PencilLine size={16} /></Link>
      <button type="button" className={`${styles.iconAction} ${styles.danger}`} onClick={() => setArchiveTarget(record)} title="Archive draft" aria-label={`Archive ${proformaReference(record)}`}><Archive size={16} /></button>
    </>}
  </div>
  const columns = [
    { key: 'reference', header: 'Proforma', width: '19%', cell: (row) => <div className={styles.twoLines}>
      <Link to={`/app/proforma-invoices/${row.id}`} className={`${styles.invoiceLink} num ref`}>{proformaReference(row)}</Link><small>{row.subject || row.reference || 'Sales proposal'}</small></div> },
    { key: 'customer', header: 'Customer', width: '20%', cell: (row) => <div className={styles.twoLines}><strong>{row.customer_name_snapshot || 'Unknown customer'}</strong><small>{row.reference || '—'}</small></div> },
    { key: 'dates', header: 'Issued / expires', width: '20%', cell: (row) => <div className={styles.twoLines}><span className="num">{formatDate(row.issue_date)}</span><small className="num">Expires {formatDate(row.expiry_date)}</small></div> },
    { key: 'amount', header: 'Value', width: '21%', cell: (row) => <strong className="num">{money(row.total_amount, row.currency)}</strong> },
    { key: 'status', header: 'Status', width: '20%', cell: badge },
  ]
  const empty = <div className={styles.empty}>
    <FileSignature size={30} aria-hidden="true" />
    <h2>{hasFilters ? 'No matching proforma invoices' : 'Create your first proforma invoice'}</h2>
    <p>{hasFilters ? 'Try changing the filters to see other proformas.' : 'Prepare and issue customer quotations separately from tax invoices.'}</p>
    {!hasFilters && canCreate && <Button icon={FilePlus2} to="/app/proforma-invoices/new">Create proforma</Button>}
  </div>
  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Sales documents" title="Proforma Invoices" description="Manage draft and issued customer proposals. These are not NRS tax invoices."
      actions={canCreate && <Button icon={FilePlus2} to="/app/proforma-invoices/new">New proforma</Button>} />
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : typeof value === 'number' ? value.toLocaleString('en-NG') : value} tone={tone} />
    ))}</div>
    <div className={styles.filters}>
      <FilterBar search={search} onSearchChange={searchChanged} busy={refreshing && !loading}
        placeholder="Search proforma number, customer, subject or reference..."
        filters={[{ key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: PROFORMA_STATUSES, icon: SlidersHorizontal }]}
        chips={chips} onReset={reset} />
      <div className={styles.dateFilters} aria-label="Proforma issue date filters">
        <div className={styles.dateField}><span>From date</span><DatePicker id="proforma-filter-from" value={dateFrom} max={dateTo || undefined}
          onChange={(value) => change({ date_from: value, date_to: value && dateTo && value > dateTo ? '' : dateTo, page: 1 })} /></div>
        <div className={styles.dateField}><span>To date</span><DatePicker id="proforma-filter-to" value={dateTo} min={dateFrom || undefined}
          onChange={(value) => change({ date_to: value, page: 1 })} /></div>
        {(dateFrom || dateTo) && <button type="button" className={styles.clearDates} onClick={() => change({ date_from: '', date_to: '', page: 1 })}><X size={14} /> Clear dates</button>}
      </div>
    </div>
    {error ? <div className={styles.empty} role="alert"><h2>Proforma invoices unavailable</h2><p>{error}</p><Button onClick={() => setReload((n) => n + 1)}>Try again</Button></div> : <>
      <DataTable columns={columns} minWidth={890} rows={records} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(record) => <>
          <div className={styles.mobileTop}><div className={styles.mobileInvoice}><Link to={`/app/proforma-invoices/${record.id}`}>{proformaReference(record)}</Link><small>{record.customer_name_snapshot || 'Unknown customer'}</small></div>{badge(record)}</div>
          <div className={styles.mobileRow}><strong className="num">{money(record.total_amount, record.currency)}</strong><span className="num">{formatDate(record.issue_date)}</span></div>
          <div className={styles.mobileChips}><span>Valid until {formatDate(record.expiry_date)}</span></div>
          <div className={styles.mobileFooter}><span>{record.subject || 'Sales proposal'}</span>{actions(record)}</div>
        </>} />
      {!loading && records.length > 0 && <Pagination noun="proformas" page={page} limit={limit} total={Number(pagination.total) || 0}
        totalPages={Number(pagination.total_pages) || undefined} disabled={refreshing} onPageChange={(value) => change({ page: value })}
        onLimitChange={(value) => change({ page: 1, limit: value })} />}
    </>}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive proforma draft?"
      message={archiveTarget ? `Archive ${proformaReference(archiveTarget)}? This removes the draft from active records.` : ''}
      confirmLabel="Archive draft" variant="danger" loading={archiving} onConfirm={archive}
      onClose={() => !archiving && setArchiveTarget(null)} />
  </div>
}
