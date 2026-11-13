import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, Building2, Download, Eye, FileBadge2, MapPin, Pencil, Plus, SlidersHorizontal, UsersRound } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import CustomerFormDrawer from './CustomerFormDrawer'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import customerService from '../../services/customerService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { hasPermission } from '../../utils/permissions'
import { CUSTOMER_TYPES, CUSTOMER_STATUS_OPTIONS, typeLabel } from './customerOptions'
import styles from './Customers.module.css'

const safePage = (value, fallback = 1) => Math.max(1, Math.floor(Number(value) || fallback))
const parseLimit = (value) => [10, 20, 50].includes(Number(value)) ? Number(value) : 10
const escapeCSV = (value) => {
  let str = String(value ?? '')
  // Prevent cells from being interpreted as formulas in spreadsheet applications.
  if (/^[\s]*[=+@\-]/.test(str)) str = `'${str}`
  return `"${str.replace(/"/g, '""')}"`
}
const exportPage = (customers, page) => {
  const headings = ['Customer code', 'Customer name', 'Type', 'Email', 'Phone', 'City', 'State', 'TIN', 'Status']
  const records = customers.map((c) => [c.customer_code, c.name, typeLabel(c.customer_type), c.email, c.phone, c.city, c.state, c.tax_identification_number, c.archived_at ? 'Archived' : Number(c.is_active) ? 'Active' : 'Inactive'])
  const csv = '\uFEFF' + [headings, ...records].map((cells) => cells.map(escapeCSV).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `customers-page-${page}.csv`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
// TIN wording carried over from the previous app's Customers list
const tinLabel = (customer) => (customer.tax_identification_number ? `TIN: ${customer.tax_identification_number}` : 'TIN not added')
const statusOf = (customer) => customer.archived_at ? 'archived' : Number(customer.is_active) ? 'active' : 'inactive'

export default function Customers() {
  const permissions = useAuthStore((s) => s.permissions)
  const toast = useToastStore((s) => s.showToast)
  const canManage = hasPermission(permissions, 'customers.manage')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const type = CUSTOMER_TYPES.some((t) => t.value === params.get('type')) ? params.get('type') : ''
  const status = CUSTOMER_STATUS_OPTIONS.some((s) => s.value === params.get('status')) ? params.get('status') : 'active'
  const page = safePage(params.get('page'))
  const limit = parseLimit(params.get('limit'))
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 0, limit: 10 })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState({ open: false, customer: null })
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  // Filters and page live in the URL so bookmarks, history and refresh preserve them.
  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value == null || (key === 'status' && value === 'active') || (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }, { replace: false }), [setParams])
  const handleSearch = useCallback((value) => change({ search: value, page: 1 }), [change])
  const clearFilters = useCallback(() => change({ search: '', type: '', status: 'active', page: 1 }), [change])

  useEffect(() => {
    let live = true
    setUpdating(true)
    setError('')
    customerService.list({ search: search.trim(), type: type || undefined, status, page, limit })
      .then((response) => {
        if (!live) return
        const data = response.data?.data || {}
        setCustomers(Array.isArray(data.customers) ? data.customers : [])
        setPagination(data.pagination || { page, limit, total: 0, total_pages: 0 })
      })
      .catch((requestError) => {
        if (!live) return
        const message = getErrorMessage(requestError, 'Unable to load customers.')
        setError(message)
        toast(message, 'error', 'Customers unavailable')
      })
      .finally(() => { if (live) { setLoading(false); setUpdating(false) } })
    return () => { live = false }
  }, [search, type, status, page, limit, refresh, toast])

  const onSaved = () => { setDrawer({ open: false, customer: null }); setRefresh((count) => count + 1) }
  const archive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await customerService.archive(archiveTarget.id)
      toast('Customer archived safely. Existing invoice records remain preserved.', 'success', 'Customer archived')
      setArchiveTarget(null)
      setRefresh((count) => count + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to archive this customer.'), 'error', 'Archive failed') }
    finally { setArchiving(false) }
  }

  const stats = useMemo(() => [
    { label: 'Total customers', value: Number(pagination.total) || 0, icon: UsersRound, tone: 'blue' },
    { label: 'Businesses on this page', value: customers.filter((c) => c.customer_type === 'business').length, icon: Building2, tone: 'green' },
    { label: 'Records with TIN on page', value: customers.filter((c) => c.tax_identification_number).length, icon: FileBadge2, tone: 'amber' },
  ], [pagination.total, customers])
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(type ? [{ key: 'type', label: `Type: ${typeLabel(type)}`, onRemove: () => change({ type: '', page: 1 }) }] : []),
    ...(status !== 'active' ? [{ key: 'status', label: CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label || status, onRemove: () => change({ status: 'active', page: 1 }) }] : []),
  ]
  const rowActions = (customer) => <div className={styles.rowActions}>
    <Link to={`/app/customers/${customer.id}`} className={`${styles.iconAction} ${styles.viewAction}`} title="View customer" aria-label={`View ${customer.name}`}><Eye size={16} /></Link>
    {canManage && !customer.archived_at && <><button type="button" className={styles.iconAction} onClick={() => setDrawer({ open: true, customer })} title="Edit customer" aria-label={`Edit ${customer.name}`}><Pencil size={16} /></button><button type="button" className={`${styles.iconAction} ${styles.danger}`} onClick={() => setArchiveTarget(customer)} title="Archive customer" aria-label={`Archive ${customer.name}`}><Archive size={16} /></button></>}
  </div>
  const columns = [
    { key: 'customer', header: 'Customer', width: '28%', cell: (c) => <div className={styles.customerCell}><span className={styles.avatar}>{(c.name || '?').charAt(0).toUpperCase()}</span><div className={styles.customerText}><Link to={`/app/customers/${c.id}`}>{c.name || 'Unnamed customer'}</Link><small className="num">{c.customer_code || 'Code pending'}</small></div></div> },
    { key: 'type', header: 'Type', cell: (c) => <span className={styles.type}>{typeLabel(c.customer_type)}</span> },
    { key: 'contact', header: 'Contact', cell: (c) => <div className={styles.twoLines}><span>{c.email || 'No email added'}</span><small className="num">{c.phone || 'No phone number'}</small></div> },
    { key: 'location', header: 'Location', cell: (c) => <div className={styles.twoLines}>
      <span className={styles.location}><MapPin size={13} aria-hidden="true" />{[c.city, c.state].filter(Boolean).join(', ') || 'Not provided'}</span>
      {/* As in the previous app: the customer's TIN, or "TIN not added" */}
      <small className="num">{tinLabel(c)}</small>
    </div> },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={statusOf(c)} /> },
  ]
  const filtered = Boolean(search || type || status !== 'active')
  const empty = <div className={styles.empty}><UsersRound size={27} aria-hidden="true" /><h2>{filtered ? 'No matching customers' : 'Create your first customer'}</h2><p>{filtered ? 'Adjust your search or filters to find another customer record.' : 'Customers are needed before you can prepare and issue an invoice.'}</p>{!filtered && canManage && <Button icon={Plus} onClick={() => setDrawer({ open: true, customer: null })}>Add customer</Button>}</div>

  return <div className={`${styles.page} fx-enter`}>
    <PageHeader className={styles.heading} eyebrow="Sales" title="Customers" description="Maintain accurate buyer information for compliant invoices and payment tracking." actions={<div className={styles.headerActions}>
      <Button variant="secondary" icon={Download} onClick={() => exportPage(customers, page)} disabled={loading || updating || !!error || !customers.length} title="Export the displayed customer page as CSV">Export</Button>
      {canManage && <Button icon={Plus} onClick={() => setDrawer({ open: true, customer: null })}>Add customer</Button>}
    </div>} />
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : value.toLocaleString()} tone={tone} />
    ))}</div>
    <FilterBar search={search} onSearchChange={handleSearch} busy={updating && !loading} placeholder="Search name, customer code, email or TIN..." filters={[
      { key: 'type', value: type, onChange: (v) => change({ type: v, page: 1 }), options: [{ value: '', label: 'All customer types' }, ...CUSTOMER_TYPES], icon: SlidersHorizontal },
      { key: 'status', value: status, onChange: (v) => change({ status: v, page: 1 }), options: CUSTOMER_STATUS_OPTIONS, icon: SlidersHorizontal },
    ]} chips={chips} onReset={clearFilters} />
    {error ? <div className={styles.empty} role="alert"><h2>Unable to display customers</h2><p>{error}</p><Button onClick={() => setRefresh((n) => n + 1)}>Try again</Button></div> : <>
      <DataTable columns={columns} rows={customers} loading={loading} empty={empty} actions={rowActions} renderMobileCard={(c) => <>
        <div className={styles.mobileTop}><span className={styles.avatar}>{(c.name || '?').charAt(0).toUpperCase()}</span><div className={styles.customerText}><Link to={`/app/customers/${c.id}`}>{c.name || 'Unnamed customer'}</Link><small className="num">{c.customer_code || 'Code pending'}</small></div><StatusBadge status={statusOf(c)} /></div>
        <p className={styles.mobileSubtitle}>{typeLabel(c.customer_type)}<span>{c.phone || c.email || 'No contact added'}</span><span className="num">{tinLabel(c)}</span></p>
        <div className={styles.mobileBottom}><span><MapPin size={12} />{[c.city, c.state].filter(Boolean).join(', ') || 'Not provided'}</span><div>{rowActions(c)}</div></div>
      </>} />
      {!loading && customers.length > 0 && <Pagination page={page} limit={limit} total={Number(pagination.total) || 0} totalPages={Number(pagination.total_pages) || undefined} disabled={updating} onPageChange={(n) => change({ page: n })} onLimitChange={(n) => change({ limit: n, page: 1 })} />}
    </>}
    {canManage && <CustomerFormDrawer open={drawer.open} customer={drawer.customer} onClose={() => setDrawer({ open: false, customer: null })} onSaved={onSaved} />}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive customer?" message={archiveTarget ? `Archive ${archiveTarget.name}? The customer will no longer be available for new invoices, but historical documents remain preserved.` : ''} confirmLabel="Archive customer" variant="danger" loading={archiving} onConfirm={archive} onClose={() => !archiving && setArchiveTarget(null)} />
  </div>
}
