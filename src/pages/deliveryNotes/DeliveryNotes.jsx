import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, CalendarDays, Eye, FileCheck2, FilePlus2, PencilLine, SlidersHorizontal, Truck, X } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import DatePicker from '../../components/forms/DatePicker'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import deliveryNoteService from '../../services/deliveryNoteService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { DELIVERY_STATUSES, deliveryCollection, deliveryEditable, deliveryReference, deliveryStatusLabel, deliveryStatusTone } from './deliveryNoteModel'
import styles from '../invoices/Invoices.module.css'

const positivePage = (value) => Math.max(1, Math.floor(Number(value) || 1))
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())

export default function DeliveryNotes() {
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canCreate = hasPermission(permissions, 'delivery_notes.create')
  const canEdit = hasPermission(permissions, 'delivery_notes.edit')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const status = DELIVERY_STATUSES.some((entry) => entry.value === params.get('status')) ? params.get('status') : 'all'
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
  const hasFilters = Boolean(search || status !== 'all' || dateFrom || dateTo)
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: deliveryStatusLabel(status), onRemove: () => change({ status: 'all', page: 1 }) }] : []),
  ]

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    deliveryNoteService.list({ search: search.trim() || undefined, status, date_from: dateFrom || undefined,
      date_to: dateTo || undefined, page, limit })
      .then((response) => {
        if (!active) return
        const data = deliveryCollection(response)
        setRecords(data.records)
        setPagination(data.pagination)
      }).catch((requestError) => {
        if (!active) return
        setError(getErrorMessage(requestError, 'Unable to load delivery notes.'))
        setRecords([])
      }).finally(() => { if (active) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [search, status, dateFrom, dateTo, page, limit, reload])

  const counts = useMemo(() => ({
    draft: records.filter((record) => record.status === 'draft').length,
    issued: records.filter((record) => record.status === 'issued').length,
    sent: records.filter((record) => Number(record.sent_count) > 0).length,
  }), [records])
  const stats = [
    { label: 'Total delivery notes', value: Number(pagination.total) || 0, icon: Truck, tone: 'blue' },
    { label: 'Drafts on this page', value: counts.draft, icon: FilePlus2, tone: 'amber' },
    { label: 'Issued on this page', value: counts.issued, icon: FileCheck2, tone: 'green' },
    { label: 'Emailed on this page', value: counts.sent, icon: CalendarDays, tone: 'teal' },
  ]
  const archive = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    try {
      await deliveryNoteService.archive(archiveTarget.id)
      toast('Delivery note draft archived successfully.', 'success', 'Draft archived')
      setArchiveTarget(null)
      setReload((value) => value + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to archive delivery note.'), 'error', 'Archive failed') }
    finally { setArchiving(false) }
  }
  const badge = (record) => <StatusBadge status={record.status} label={deliveryStatusLabel(record.status)} tone={deliveryStatusTone(record.status)} />
  const actions = (record) => <div className={styles.rowActions}>
    <Link className={`${styles.iconAction} ${styles.viewAction}`} to={`/app/delivery-notes/${record.id}`} title="View delivery note" aria-label={`View ${deliveryReference(record)}`}><Eye size={16} /></Link>
    {canEdit && deliveryEditable(record) && <>
      <Link className={styles.iconAction} to={`/app/delivery-notes/${record.id}/edit`} title="Edit draft" aria-label={`Edit ${deliveryReference(record)}`}><PencilLine size={16} /></Link>
      <button type="button" className={`${styles.iconAction} ${styles.danger}`} onClick={() => setArchiveTarget(record)} title="Archive draft" aria-label={`Archive ${deliveryReference(record)}`}><Archive size={16} /></button>
    </>}
  </div>
  const columns = [
    { key: 'reference', header: 'Delivery note', width: '19%', cell: (row) => <div className={styles.twoLines}>
      <Link to={`/app/delivery-notes/${row.id}`} className={`${styles.invoiceLink} num ref`}>{deliveryReference(row)}</Link><small>{row.reference || 'Delivery record'}</small></div> },
    { key: 'customer', header: 'Customer', width: '21%', cell: (row) => <strong>{row.customer_name_snapshot || 'Unknown customer'}</strong> },
    { key: 'invoice', header: 'Source invoice', width: '19%', cell: (row) => <span className="num ref">{row.invoice_number || `Invoice #${row.invoice_id}`}</span> },
    { key: 'date', header: 'Delivery date', width: '21%', cell: (row) => <span className="num">{formatDate(row.delivery_date)}</span> },
    { key: 'status', header: 'Status', width: '20%', cell: badge },
  ]
  const empty = <div className={styles.empty}><Truck size={30} aria-hidden="true" />
    <h2>{hasFilters ? 'No matching delivery notes' : 'Create your first delivery note'}</h2>
    <p>{hasFilters ? 'Try adjusting your filters.' : 'Record full or partial deliveries against approved invoices.'}</p>
    {!hasFilters && canCreate && <Button icon={FilePlus2} to="/app/delivery-notes/new">Create delivery note</Button>}
  </div>

  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Sales documents" title="Delivery Notes" description="Track dispatched quantities against approved invoices without creating a new tax invoice."
      actions={canCreate && <Button icon={FilePlus2} to="/app/delivery-notes/new">New delivery note</Button>} />
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : Number(value).toLocaleString('en-NG')} tone={tone} />
    ))}</div>
    <div className={styles.filters}>
      <FilterBar search={search} onSearchChange={(value) => change({ search: value, page: 1 })} busy={refreshing && !loading}
        placeholder="Search delivery note, customer, invoice or reference..."
        filters={[{ key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: DELIVERY_STATUSES, icon: SlidersHorizontal }]}
        chips={chips} onReset={reset} />
      <div className={styles.dateFilters} aria-label="Delivery date filters">
        <div className={styles.dateField}><span>From date</span><DatePicker id="delivery-filter-from" value={dateFrom} max={dateTo || undefined}
          onChange={(value) => change({ date_from: value, date_to: value && dateTo && value > dateTo ? '' : dateTo, page: 1 })} /></div>
        <div className={styles.dateField}><span>To date</span><DatePicker id="delivery-filter-to" value={dateTo} min={dateFrom || undefined}
          onChange={(value) => change({ date_to: value, page: 1 })} /></div>
        {(dateFrom || dateTo) && <button type="button" className={styles.clearDates} onClick={() => change({ date_from: '', date_to: '', page: 1 })}><X size={14} /> Clear dates</button>}
      </div>
    </div>
    {error ? <div className={styles.empty} role="alert"><h2>Delivery notes unavailable</h2><p>{error}</p><Button onClick={() => setReload((v) => v + 1)}>Try again</Button></div> : <>
      <DataTable columns={columns} minWidth={830} rows={records} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(record) => <>
          <div className={styles.mobileTop}><div className={styles.mobileInvoice}><Link to={`/app/delivery-notes/${record.id}`}>{deliveryReference(record)}</Link>
            <small>{record.customer_name_snapshot || 'Unknown customer'}</small></div>{badge(record)}</div>
          <div className={styles.mobileRow}><strong className="num ref">{record.invoice_number || `Invoice #${record.invoice_id}`}</strong><span className="num">{formatDate(record.delivery_date)}</span></div>
          <div className={styles.mobileChips}><span>{record.reference || 'Delivery record'}</span></div>
          <div className={styles.mobileFooter}><span>{record.sent_count ? `${record.sent_count} email sends` : 'Not emailed yet'}</span>{actions(record)}</div>
        </>} />
      {!loading && records.length > 0 && <Pagination noun="delivery notes" page={page} limit={limit} total={Number(pagination.total) || 0}
        totalPages={Number(pagination.total_pages) || undefined} disabled={refreshing} onPageChange={(value) => change({ page: value })}
        onLimitChange={(value) => change({ page: 1, limit: value })} />}
    </>}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive delivery note draft?"
      message={archiveTarget ? `Archive ${deliveryReference(archiveTarget)}? Issued delivery notes cannot be archived.` : ''}
      confirmLabel="Archive draft" variant="danger" loading={archiving} onConfirm={archive}
      onClose={() => !archiving && setArchiveTarget(null)} />
  </div>
}
