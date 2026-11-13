import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, CalendarDays, Eye, FileCheck2, FileMinus2, FilePlus2, PencilLine, SlidersHorizontal, WalletCards, X } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import DatePicker from '../../components/forms/DatePicker'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import creditNoteService from '../../services/creditNoteService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { creditNoteCollection, CREDIT_NOTE_STATUSES } from './creditNoteEditorModel'
import { creditNoteReferenceLabel, creditNoteStatusLabel } from '../../components/documents/labels'
import { creditNoteTone } from './creditNoteDetailsModel'
import styles from '../invoices/Invoices.module.css'

const readPage = (value) => Math.max(1, Math.floor(Number(value) || 1))
const readLimit = (value) => [10, 20, 50].includes(Number(value)) ? Number(value) : 10
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
const money = (amount, unit) => { try { return formatCurrency(amount, unit || 'NGN') } catch { return `${unit || 'NGN'} ${Number(amount || 0).toLocaleString('en-NG')}` } }

export default function CreditNotes() {
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canCreate = hasPermission(permissions, 'credit_notes.create')
  const canEdit = hasPermission(permissions, 'credit_notes.edit')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const status = CREDIT_NOTE_STATUSES.some((item) => item.value === params.get('status')) ? params.get('status') : 'all'
  const dateFrom = validDate(params.get('date_from')) ? params.get('date_from') : ''
  const dateTo = validDate(params.get('date_to')) ? params.get('date_to') : ''
  const page = readPage(params.get('page'))
  const limit = readLimit(params.get('limit'))
  const [notes, setNotes] = useState([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)

  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === '' || (key === 'status' && value === 'all') ||
        (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    })
    return next
  }), [setParams])
  const resetFilters = useCallback(() => change({ search: '', status: 'all', date_from: '', date_to: '', page: 1 }), [change])
  const searchChanged = useCallback((value) => change({ search: value, page: 1 }), [change])
  const hasFilters = Boolean(search || status !== 'all' || dateFrom || dateTo)
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: CREDIT_NOTE_STATUSES.find((item) => item.value === status)?.label || status, onRemove: () => change({ status: 'all', page: 1 }) }] : []),
  ]

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    creditNoteService.list({ search: search.trim() || undefined, status,
      date_from: dateFrom || undefined, date_to: dateTo || undefined, page, limit })
      .then((response) => {
        if (!active) return
        const data = creditNoteCollection(response)
        setNotes(data.notes)
        setPagination(data.pagination)
      }).catch((requestError) => {
        if (!active) return
        const message = getErrorMessage(requestError, 'Unable to load credit notes.')
        setError(message)
        toast(message, 'error', 'Credit notes unavailable')
      }).finally(() => { if (active) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [search, status, dateFrom, dateTo, page, limit, reload, toast])

  const metrics = useMemo(() => {
    const currencies = new Set(notes.map((note) => note.currency || 'NGN'))
    return {
      draft: notes.filter((note) => note.status === 'draft').length,
      pending: notes.filter((note) => note.status === 'pending_approval').length,
      approved: notes.filter((note) => note.status === 'approved').length,
      amount: currencies.size > 1 ? 'Mixed currencies' : money(notes.reduce((sum, note) => sum + Number(note.total_amount || 0), 0), notes[0]?.currency),
    }
  }, [notes])
  const stats = [
    { label: 'Total credit note records', value: Number(pagination.total) || 0, icon: FileMinus2, tone: 'blue' },
    { label: 'Drafts on this page', value: metrics.draft, icon: FilePlus2, tone: 'teal' },
    { label: 'Awaiting approval on page', value: metrics.pending, icon: CalendarDays, tone: 'amber' },
    { label: 'Approved on this page', value: metrics.approved, icon: FileCheck2, tone: 'green' },
    { label: 'Page credit value', value: metrics.amount, icon: WalletCards, tone: 'violet' },
  ]

  const archiveNote = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    try {
      await creditNoteService.archive(archiveTarget.id)
      toast('Credit note draft archived successfully.', 'success', 'Draft archived')
      setArchiveTarget(null)
      setReload((previous) => previous + 1)
    } catch (requestError) {
      toast(getErrorMessage(requestError, 'Unable to archive credit note.'), 'error', 'Archive failed')
    } finally { setArchiving(false) }
  }
  const badge = (note) => <StatusBadge status={note.status} label={creditNoteStatusLabel(note.status)} tone={creditNoteTone(note.status)} />
  const actions = (note) => {
    const ref = creditNoteReferenceLabel(note)
    return <div className={styles.rowActions}>
      <Link className={`${styles.iconAction} ${styles.viewAction}`} to={`/app/credit-notes/${note.id}`} aria-label={`View ${ref}`} title="View credit note"><Eye size={16} /></Link>
      {canEdit && ['draft', 'rejected'].includes(note.status) && <>
        <Link className={styles.iconAction} to={`/app/credit-notes/${note.id}/edit`} aria-label={`Edit ${ref}`} title="Edit credit note"><PencilLine size={16} /></Link>
        <button type="button" className={`${styles.iconAction} ${styles.danger}`} onClick={() => setArchiveTarget(note)} aria-label={`Archive ${ref}`} title="Archive draft"><Archive size={16} /></button>
      </>}
    </div>
  }
  const columns = [
    { key: 'reference', header: 'Credit note', width: '16%', cell: (note) => <div className={styles.twoLines}><Link className={`${styles.invoiceLink} num ref`} to={`/app/credit-notes/${note.id}`}>{creditNoteReferenceLabel(note)}</Link><small>{note.reason_category?.replaceAll('_', ' ') || 'Credit adjustment'}</small></div> },
    { key: 'invoice', header: 'Source invoice', width: '17%', cell: (note) => <div className={styles.twoLines}><strong className="num ref">{note.invoice_number || `Invoice #${note.invoice_id}`}</strong><small>{note.customer_name_snapshot || 'Unknown customer'}</small></div> },
    { key: 'date', header: 'Credit note date', width: '18%', cell: (note) => <span className="num">{formatDate(note.credit_note_date)}</span> },
    { key: 'total', header: 'Credit amount', width: '25%', cell: (note) => <strong className="num">{money(note.total_amount, note.currency)}</strong> },
    { key: 'status', header: 'Workflow', width: '24%', cell: badge },
  ]
  const empty = <div className={styles.empty}>
    <FileMinus2 size={30} aria-hidden="true" />
    <h2>{hasFilters ? 'No matching credit notes' : 'Create your first credit note'}</h2>
    <p>{hasFilters ? 'Change the filters to find another credit note.' : 'Credit notes adjust approved invoices through a controlled approval workflow.'}</p>
    {!hasFilters && canCreate && <Button icon={FilePlus2} to="/app/credit-notes/new">Create credit note</Button>}
  </div>

  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Sales documents" title="Credit Notes" description="Manage returns, billing corrections and controlled invoice adjustments."
      actions={canCreate && <Button icon={FilePlus2} to="/app/credit-notes/new">New credit note</Button>} />
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : typeof value === 'number' ? value.toLocaleString('en-NG') : value} tone={tone} />
    ))}</div>
    <div className={styles.filters}>
      <FilterBar search={search} onSearchChange={searchChanged} busy={refreshing && !loading}
        placeholder="Search credit note, customer, invoice or reason..."
        filters={[{ key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: CREDIT_NOTE_STATUSES, icon: SlidersHorizontal }]}
        chips={chips} onReset={resetFilters} />
      <div className={styles.dateFilters} aria-label="Credit note date filters">
        <div className={styles.dateField}><span>From date</span><DatePicker id="credit-note-date-from" value={dateFrom} onChange={(value) => change({ date_from: value, date_to: value && dateTo && value > dateTo ? '' : dateTo, page: 1 })} max={dateTo || undefined} placeholder="From date" /></div>
        <div className={styles.dateField}><span>To date</span><DatePicker id="credit-note-date-to" value={dateTo} onChange={(value) => change({ date_to: value, page: 1 })} min={dateFrom || undefined} placeholder="To date" /></div>
        {(dateFrom || dateTo) && <button type="button" className={styles.clearDates} onClick={() => change({ date_from: '', date_to: '', page: 1 })}><X size={14} /> Clear dates</button>}
      </div>
    </div>
    {error ? <div className={styles.empty} role="alert"><h2>Credit notes unavailable</h2><p>{error}</p><Button onClick={() => setReload((count) => count + 1)}>Retry</Button></div> : <>
      <DataTable minWidth={900} columns={columns} rows={notes} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(note) => <>
          <div className={styles.mobileTop}><div className={styles.mobileInvoice}><Link to={`/app/credit-notes/${note.id}`}>{creditNoteReferenceLabel(note)}</Link><small>{note.customer_name_snapshot || 'Unknown customer'}</small></div>{badge(note)}</div>
          <div className={styles.mobileRow}><strong className="num">{money(note.total_amount, note.currency)}</strong><span className="num">{formatDate(note.credit_note_date)}</span></div>
          <div className={styles.mobileChips}><span className="num ref">{note.invoice_number || `Invoice #${note.invoice_id}`}</span></div>
          <div className={styles.mobileFooter}><span>{note.reason_category?.replaceAll('_', ' ') || 'Credit adjustment'}</span>{actions(note)}</div>
        </>} />
      {!loading && notes.length > 0 && <Pagination noun="credit notes" page={page} limit={limit} total={Number(pagination.total) || 0}
        totalPages={Number(pagination.total_pages) || undefined} disabled={refreshing} onPageChange={(next) => change({ page: next })} onLimitChange={(next) => change({ page: 1, limit: next })} />}
    </>}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive credit note draft?"
      message={archiveTarget ? `Archive ${creditNoteReferenceLabel(archiveTarget)}? Archived drafts are removed from the active credit note workflow.` : ''}
      confirmLabel="Archive draft" variant="danger" loading={archiving} onConfirm={archiveNote} onClose={() => !archiving && setArchiveTarget(null)} />
  </div>
}
