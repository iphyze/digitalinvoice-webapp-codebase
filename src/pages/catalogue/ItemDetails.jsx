import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, CalendarClock, FilePlus2, Package, PencilLine, Percent, RefreshCw, Ruler, ShieldCheck, Wrench } from 'lucide-react'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Skeleton from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import ItemFormDrawer from './ItemFormDrawer'
import itemService from '../../services/itemService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { hasPermission } from '../../utils/permissions'
import { itemTypeLabel, treatmentLabel } from './catalogueOptions'
import styles from './ItemDetails.module.css'

const display = (value) => value == null || value === '' ? '—' : value
const statusOf = (item) => item.archived_at ? 'archived' : Number(item.is_active) ? 'active' : 'inactive'
function DetailRow({ label, value, numeric = false }) {
  return <div className={styles.detailRow}><dt>{label}</dt><dd className={numeric ? 'num' : undefined}>{display(value)}</dd></div>
}
function DetailSection({ icon: Icon, title, description, children }) {
  return <section className={styles.card}><div className={styles.sectionTitle}><span className={styles.sectionIcon}><Icon size={18} aria-hidden="true" /></span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>
}
function DetailsSkeleton() {
  return <div className={styles.page} aria-busy="true" aria-label="Loading catalogue item"><Skeleton width="140px" height="16px" />
    <div className={styles.skeletonHero}><Skeleton width="60%" height="30px" />{[0, 1, 2].map((x) => <Skeleton key={x} height="22px" />)}</div>
    <div className={styles.grid}>{[0, 1, 2, 3].map((x) => <div key={x} className={styles.skeletonCard}><Skeleton width="58%" height="18px" />{[0, 1, 2].map((i) => <Skeleton key={i} height="16px" />)}</div>)}</div>
  </div>
}
export default function ItemDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const toast = useToastStore((s) => s.showToast)
  const canManage = hasPermission(permissions, 'catalogue.manage')
  const canCreateInvoice = hasPermission(permissions, 'invoices.create')
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setItem(null)
    itemService.show(id)
      .then((response) => { if (active) setItem(response.data?.data?.item || null) })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Unable to retrieve this catalogue item.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, reload])
  const refresh = useCallback(() => setReload((value) => value + 1), [])
  const archive = async () => {
    if (!item || archiving) return
    setArchiving(true)
    try {
      await itemService.archive(item.id)
      toast('Item archived safely. Historical invoice records remain protected.', 'success', 'Item archived')
      navigate('/app/catalogue')
    } catch (requestError) {
      toast(getErrorMessage(requestError, 'Unable to archive item.'), 'error', 'Archive failed')
    } finally { setArchiving(false); setArchiveOpen(false) }
  }

  if (loading) return <DetailsSkeleton />
  if (error || !item) return <div className={`${styles.page} fx-enter`}><Link className={styles.back} to="/app/catalogue"><ArrowLeft size={16} /> Back to Products & Services</Link><div className={styles.unavailable} role="alert"><span className={styles.unavailableIcon}><Package size={24} /></span><h1>Item unavailable</h1><p>{error || 'This product or service could not be found.'}</p><div className={styles.unavailableActions}><Button variant="secondary" to="/app/catalogue" icon={ArrowLeft}>Back to catalogue</Button><Button icon={RefreshCw} onClick={refresh}>Try again</Button></div></div></div>

  const type = itemTypeLabel(item.item_type)
  const status = statusOf(item)
  const price = formatCurrency(item.default_unit_price, item.currency || 'NGN')
  const unit = item.unit_symbol || item.unit_name || item.unit_code || 'unit'
  const canEdit = canManage && !item.archived_at
  const canInvoice = canCreateInvoice && Number(item.is_active) === 1 && !item.archived_at
  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link className={styles.back} to="/app/catalogue"><ArrowLeft size={16} /> Products & Services</Link><div className={styles.actions}>
      {canEdit && <Button variant="secondary" icon={PencilLine} onClick={() => setEditing(true)}>Edit item</Button>}
      {canInvoice && <Button icon={FilePlus2} to={`/app/invoices/new?item=${encodeURIComponent(item.id)}`}>Create invoice</Button>}
    </div></div>
    <section className={styles.hero} aria-labelledby="item-detail-name"><div className={styles.heroMain}>
      <span className={styles.avatar} data-type={item.item_type}>{item.item_type === 'product' ? <Package size={28} /> : <Wrench size={27} />}</span>
      <div className={styles.identity}><div className={styles.idLine}><span className={styles.eyebrow}>{type} record</span><span className={`${styles.code} num`}>{item.item_code || 'Uncoded item'}</span></div>
        <h1 id="item-detail-name">{item.name || 'Unnamed item'}</h1><div className={styles.identityMeta}><span className="num">{price}</span><span className={styles.dot} aria-hidden="true" /><span>per {unit}</span></div>
      </div><StatusBadge status={status} />
    </div>{item.description && <div className={styles.description}><span>Item description</span><p>{item.description}</p></div>}</section>
    <div className={styles.grid}>
      <DetailSection icon={Ruler} title="Pricing & unit" description="Default pricing information for invoice lines."><dl className={styles.details}>
        <DetailRow label="Item type" value={type} /><DetailRow label="Unit price" value={price} numeric /><DetailRow label="Currency" value={item.currency} numeric /><DetailRow label="Unit of measure" value={`${item.unit_name || item.unit_code || '—'}${item.unit_symbol ? ` (${item.unit_symbol})` : ''}`} /><DetailRow label="Discounts" value={Number(item.discount_allowed) ? 'Allowed' : 'Not permitted'} />
      </dl></DetailSection>
      <DetailSection icon={Percent} title="Tax treatment" description="Applied tax treatment for this catalogue record."><dl className={styles.details}>
        <DetailRow label="Tax name" value={item.tax_name} /><DetailRow label="Treatment" value={treatmentLabel(item.tax_treatment)} /><DetailRow label="Tax rate" value={`${Number(item.tax_rate_percent || 0).toFixed(2)}%`} numeric /><DetailRow label="Tax code" value={item.tax_code} />
      </dl></DetailSection>
      <DetailSection icon={ShieldCheck} title="Compliance readiness" description="Local classification and readiness mappings."><dl className={styles.details}>
        <DetailRow label="NRS item code (local)" value={item.nrs_item_classification_code || 'Not provided yet'} /><DetailRow label="FIRS item type" value={item.firs_item_type} /><DetailRow label="FIRS tax category" value={item.firs_tax_category_code} /><DetailRow label="FIRS unit code" value={item.firs_unit_code} /><DetailRow label="VAT exemption mapping" value={item.firs_vat_exemption_code} /><DetailRow label="Submission status" value="Internal record only" />
      </dl>{!item.nrs_item_classification_code && <p className={styles.readiness}>NRS classification can be supplied when the external integration becomes available.</p>}</DetailSection>
      <DetailSection icon={CalendarClock} title="Record summary" description="Record timestamps and availability."><dl className={styles.details}>
        <DetailRow label="Created" value={item.created_at ? formatDate(item.created_at) : '—'} /><DetailRow label="Last updated" value={item.updated_at ? formatDate(item.updated_at) : '—'} /><DetailRow label="Availability" value={status.charAt(0).toUpperCase() + status.slice(1)} />
      </dl><div className={styles.notes}><span><Archive size={15} /> Historical documents</span><p>Archiving prevents this item from being used on new invoices without deleting historical references.</p></div>
      {canEdit && <button className={styles.archive} type="button" onClick={() => setArchiveOpen(true)}><Archive size={15} /> Archive this item</button>}
      </DetailSection>
    </div>
    {canManage && <ItemFormDrawer open={editing} item={item} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh() }} />}
    <ConfirmDialog open={archiveOpen} title="Archive item?" message={`Archive ${item.name}? The item will no longer be available for new invoices.`} confirmLabel="Archive item" variant="danger" loading={archiving} onClose={() => !archiving && setArchiveOpen(false)} onConfirm={archive} />
  </div>
}
