import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, Boxes, Eye, Package, Pencil, Plus, SlidersHorizontal, Tags, Wrench } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import ItemFormDrawer from './ItemFormDrawer'
import itemService from '../../services/itemService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { formatCurrency } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { hasPermission } from '../../utils/permissions'
import { ITEM_TYPES, ITEM_STATUS_OPTIONS, itemTypeLabel, treatmentLabel } from './catalogueOptions'
import styles from './Catalogue.module.css'

const readPage = (v) => Math.max(1, Math.floor(Number(v) || 1))
const readLimit = (v) => [10, 20, 50].includes(Number(v)) ? Number(v) : 10
const statusOf = (item) => item.archived_at ? 'archived' : Number(item.is_active) ? 'active' : 'inactive'
const money = (item) => formatCurrency(item.default_unit_price, item.currency || 'NGN')
const itemUnit = (item) => item.unit_symbol || item.unit_name || item.unit_code || 'unit'

export default function Catalogue() {
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canManage = hasPermission(permissions, 'catalogue.manage')
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const type = ITEM_TYPES.some((option) => option.value === params.get('type')) ? params.get('type') : ''
  const status = ITEM_STATUS_OPTIONS.some((option) => option.value === params.get('status')) ? params.get('status') : 'active'
  const page = readPage(params.get('page'))
  const limit = readLimit(params.get('limit'))
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState({ open: false, item: null })
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [reload, setReload] = useState(0)

  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value == null || (key === 'status' && value === 'active') ||
        (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }), [setParams])
  const handleSearch = useCallback((value) => change({ search: value, page: 1 }), [change])
  const resetFilters = useCallback(() => change({ search: '', type: '', status: 'active', page: 1 }), [change])

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    itemService.list({ search: search.trim(), type: type || undefined, status, page, limit })
      .then((response) => {
        if (!active) return
        const data = response.data?.data || {}
        setItems(Array.isArray(data.items) ? data.items : [])
        setPagination(data.pagination || { total: 0, total_pages: 0, page, limit })
      })
      .catch((requestError) => {
        if (!active) return
        const message = getErrorMessage(requestError, 'Unable to load products and services.')
        setError(message)
        toast(message, 'error', 'Catalogue unavailable')
      })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [search, type, status, page, limit, reload, toast])

  const stats = useMemo(() => [
    { label: 'Total catalogue records', count: Number(pagination.total) || 0, icon: Boxes, tone: 'blue' },
    { label: 'Products on this page', count: items.filter((item) => item.item_type === 'product').length, icon: Package, tone: 'green' },
    { label: 'Services on this page', count: items.filter((item) => item.item_type === 'service').length, icon: Wrench, tone: 'amber' },
    { label: 'Taxable records on page', count: items.filter((item) => Number(item.tax_rate_percent) > 0).length, icon: Tags, tone: 'violet' },
  ], [pagination.total, items])
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(type ? [{ key: 'type', label: `Type: ${itemTypeLabel(type)}`, onRemove: () => change({ type: '', page: 1 }) }] : []),
    ...(status !== 'active' ? [{ key: 'status', label: ITEM_STATUS_OPTIONS.find((s) => s.value === status)?.label || status, onRemove: () => change({ status: 'active', page: 1 }) }] : []),
  ]
  const saved = () => { setDrawer({ open: false, item: null }); setReload((value) => value + 1) }
  const archive = async () => {
    if (!archiveTarget || archiving) return
    setArchiving(true)
    try {
      await itemService.archive(archiveTarget.id)
      toast('Item archived safely. Historical invoices remain unchanged.', 'success', 'Item archived')
      setArchiveTarget(null)
      setReload((value) => value + 1)
    } catch (requestError) {
      toast(getErrorMessage(requestError, 'Unable to archive this item.'), 'error', 'Archive failed')
    } finally { setArchiving(false) }
  }

  const rowActions = (item) => <div className={styles.rowActions}>
    <Link to={`/app/catalogue/${item.id}`} className={`${styles.iconAction} ${styles.viewAction}`} title="View item" aria-label={`View ${item.name}`}><Eye size={16} /></Link>
    {canManage && !item.archived_at && <>
      <button type="button" className={styles.iconAction} title="Edit item" aria-label={`Edit ${item.name}`} onClick={() => setDrawer({ open: true, item })}><Pencil size={16} /></button>
      <button type="button" className={`${styles.iconAction} ${styles.danger}`} title="Archive item" aria-label={`Archive ${item.name}`} onClick={() => setArchiveTarget(item)}><Archive size={16} /></button>
    </>}
  </div>
  const columns = [
    { key: 'item', header: 'Product / Service', width: '28%', cell: (item) => <div className={styles.itemCell}>
      <span className={styles.avatar} data-type={item.item_type}>{item.item_type === 'product' ? <Package size={17} /> : <Wrench size={17} />}</span>
      <div className={styles.itemText}><Link to={`/app/catalogue/${item.id}`}>{item.name || 'Unnamed item'}</Link><small className="num">{item.item_code || 'No item code'} · {item.unit_name || item.unit_code || 'Unit not set'}</small></div>
    </div> },
    { key: 'type', header: 'Type', cell: (item) => <span className={styles.type}>{itemTypeLabel(item.item_type)}</span> },
    { key: 'pricing', header: 'Pricing', cell: (item) => <div className={styles.twoLines}><strong className="num">{money(item)}</strong><small>per {itemUnit(item)}</small></div> },
    { key: 'tax', header: 'Tax treatment', cell: (item) => <div className={styles.twoLines}><span>{item.tax_name || treatmentLabel(item.tax_treatment)}</span><small className="num">{Number(item.tax_rate_percent || 0).toFixed(2)}% · {Number(item.discount_allowed) ? 'Discount allowed' : 'Fixed price'}</small></div> },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={statusOf(item)} /> },
  ]
  const filtered = Boolean(search || type || status !== 'active')
  const empty = <div className={styles.empty}><Boxes size={29} aria-hidden="true" /><h2>{filtered ? 'No matching products or services' : 'No products or services yet'}</h2><p>{filtered ? 'Adjust your search or filters to find another catalogue record.' : 'Create your first billable item to begin preparing invoice lines.'}</p>{!filtered && canManage && <Button icon={Plus} onClick={() => setDrawer({ open: true, item: null })}>Add your first item</Button>}</div>

  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Billing catalogue" title="Products & Services" description="Maintain pricing, units and tax treatments used when preparing invoice lines." actions={canManage ? <Button icon={Plus} onClick={() => setDrawer({ open: true, item: null })}>Add item</Button> : null} />
    <div className={styles.stats}>{stats.map(({ label, count, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : count.toLocaleString()} tone={tone} />
    ))}</div>
    <FilterBar search={search} onSearchChange={handleSearch} busy={refreshing && !loading} placeholder="Search item name, item code or description..." filters={[
      { key: 'type', value: type, onChange: (value) => change({ type: value, page: 1 }), options: [{ value: '', label: 'All item types' }, ...ITEM_TYPES], icon: SlidersHorizontal },
      { key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: ITEM_STATUS_OPTIONS, icon: SlidersHorizontal },
    ]} chips={chips} onReset={resetFilters} />
    {error ? <div className={styles.empty} role="alert"><h2>Catalogue unavailable</h2><p>{error}</p><Button onClick={() => setReload((n) => n + 1)}>Retry</Button></div> : <>
      <DataTable columns={columns} rows={items} loading={loading} empty={empty} actions={rowActions} renderMobileCard={(item) => <>
        <div className={styles.mobileTop}><span className={styles.avatar} data-type={item.item_type}>{item.item_type === 'product' ? <Package size={17} /> : <Wrench size={17} />}</span><div className={styles.itemText}><Link to={`/app/catalogue/${item.id}`}>{item.name || 'Unnamed item'}</Link><small className="num">{item.item_code || 'No item code'}</small></div><StatusBadge status={statusOf(item)} /></div>
        <div className={styles.mobileMeta}><span>{itemTypeLabel(item.item_type)}</span><strong className="num">{money(item)} / {itemUnit(item)}</strong></div>
        <div className={styles.mobileBottom}><span>{item.tax_name || treatmentLabel(item.tax_treatment)} · {Number(item.tax_rate_percent || 0).toFixed(2)}%</span>{rowActions(item)}</div>
      </>} />
      {!loading && items.length > 0 && <Pagination noun="items" page={page} limit={limit} total={Number(pagination.total) || 0} totalPages={Number(pagination.total_pages) || undefined} disabled={refreshing} onPageChange={(next) => change({ page: next })} onLimitChange={(next) => change({ page: 1, limit: next })} />}
    </>}
    {canManage && <ItemFormDrawer open={drawer.open} item={drawer.item} onClose={() => setDrawer({ open: false, item: null })} onSaved={saved} />}
    <ConfirmDialog open={Boolean(archiveTarget)} title="Archive item?" message={`Archive ${archiveTarget?.name || 'this item'}? It cannot be used on new invoices, while existing document history remains preserved.`} confirmLabel="Archive item" variant="danger" loading={archiving} onClose={() => !archiving && setArchiveTarget(null)} onConfirm={archive} />
  </div>
}
