import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive, ArrowLeft, Building2, CalendarClock, ContactRound,
  FilePlus2, Mail, MapPin, PencilLine, Phone, ReceiptText, RefreshCw,
  ShieldCheck, UserRound,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Skeleton from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import CustomerFormDrawer from './CustomerFormDrawer'
import customerService from '../../services/customerService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { formatDate } from '../../utils/formatters'
import { hasPermission } from '../../utils/permissions'
import { countryLabel, typeLabel } from './customerOptions'
import styles from './CustomerDetails.module.css'

const display = (value) => value === null || value === undefined || value === '' ? '—' : value
const statusOf = (customer) => customer.archived_at ? 'archived' : Number(customer.is_active) ? 'active' : 'inactive'

function DetailRow({ label, value, mono = false }) {
  return <div className={styles.detailRow}>
    <dt>{label}</dt>
    <dd className={mono ? 'num' : undefined}>{display(value)}</dd>
  </div>
}

function DetailSection({ icon: Icon, title, description, children, className = '' }) {
  return <section className={`${styles.card} ${className}`}>
    <div className={styles.sectionTitle}>
      <span className={styles.sectionIcon}><Icon size={18} aria-hidden="true" /></span>
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    </div>
    {children}
  </section>
}

function DetailSkeleton() {
  return <div className={styles.page} aria-label="Loading customer details" aria-busy="true">
    <Skeleton width="130px" height="16px" />
    <div className={styles.skeletonHero}>
      <div className={styles.skeletonTitle}>
        <Skeleton width="68px" height="68px" radius="14px" />
        <div><Skeleton width="200px" height="15px" /><Skeleton width="min(340px, 52vw)" height="29px" /><Skeleton width="180px" height="13px" /></div>
      </div>
      <div className={styles.skeletonLines}>{[0, 1, 2].map((n) => <Skeleton key={n} height="30px" />)}</div>
    </div>
    <div className={styles.grid}>{[0, 1, 2, 3].map((n) => <div className={styles.skeletonCard} key={n}><Skeleton width="50%" height="20px" />{[0, 1, 2].map((row) => <Skeleton key={row} height="16px" />)}</div>)}</div>
  </div>
}

export default function CustomerDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const permissions = useAuthStore((s) => s.permissions)
  const toast = useToastStore((s) => s.showToast)
  const canManage = hasPermission(permissions, 'customers.manage')
  const canCreateInvoice = hasPermission(permissions, 'invoices.create')
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [reload, setReload] = useState(0)

  // Ignore late responses if navigation changes the ID or the page unmounts.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setCustomer(null)
    customerService.show(id)
      .then((response) => { if (active) setCustomer(response.data?.data?.customer || null) })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Unable to retrieve this customer.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  const archive = async () => {
    if (!customer || archiving) return
    setArchiving(true)
    try {
      await customerService.archive(customer.id)
      toast('Customer archived safely.', 'success', 'Customer archived')
      navigate('/app/customers')
    } catch (requestError) {
      toast(getErrorMessage(requestError, 'Unable to archive customer.'), 'error', 'Archive failed')
    } finally {
      setArchiving(false)
      setConfirmArchive(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !customer) return <div className={`${styles.page} fx-enter`}>
    <Link className={styles.back} to="/app/customers"><ArrowLeft size={16} /> Back to customers</Link>
    <div className={styles.unavailable} role="alert">
      <span className={styles.unavailableIcon}><UserRound size={25} /></span>
      <h1>Customer unavailable</h1>
      <p>{error || 'This customer record could not be found.'}</p>
      <div className={styles.unavailableActions}><Button variant="secondary" to="/app/customers" icon={ArrowLeft}>Back to customers</Button><Button icon={RefreshCw} onClick={refresh}>Try again</Button></div>
    </div>
  </div>

  const status = statusOf(customer)
  const address = [
    customer.billing_address_line_1, customer.billing_address_line_2, customer.city,
    customer.state, countryLabel(customer.country) === '—' ? '' : countryLabel(customer.country),
  ].filter(Boolean).join(', ')
  const customerName = customer.name || 'Unnamed customer'
  const showActions = canManage && !customer.archived_at

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}>
      <Link className={styles.back} to="/app/customers"><ArrowLeft size={16} /> Customers</Link>
      <div className={styles.actions}>
        {showActions && <Button variant="secondary" icon={PencilLine} onClick={() => setEditing(true)}>Edit customer</Button>}
        {canCreateInvoice && <Button icon={FilePlus2} to={`/app/invoices/new?customer=${encodeURIComponent(customer.id)}`}>Create invoice</Button>}
      </div>
    </div>

    <section className={styles.hero} aria-labelledby="customer-detail-name">
      <div className={styles.heroMain}>
        <div className={styles.avatar} aria-hidden="true">{customerName.charAt(0).toUpperCase()}</div>
        <div className={styles.identity}>
          <div className={styles.idLine}><span className={styles.eyebrow}>Customer record</span><span className={`${styles.code} num`}>{display(customer.customer_code)}</span></div>
          <h1 id="customer-detail-name">{customerName}</h1>
          <div className={styles.identityMeta}><span>{typeLabel(customer.customer_type)}</span><span className={styles.dot} aria-hidden="true" /> <span>Preferred currency: <strong className="num">{display(customer.preferred_currency)}</strong></span></div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className={styles.contactStrip}>
        <div><Mail size={17} aria-hidden="true" /><span>{customer.email || 'No billing email'}</span></div>
        <div><Phone size={17} aria-hidden="true" /><span className="num">{customer.phone || 'No phone number'}</span></div>
        <div><MapPin size={17} aria-hidden="true" /><span>{address || 'No billing address added'}</span></div>
      </div>
    </section>

    <div className={styles.grid}>
      <DetailSection icon={ShieldCheck} title="Compliance information" description="Tax details linked to this billing record.">
        <dl className={styles.details}>
          <DetailRow label="TIN" value={customer.tax_identification_number} mono />
          <DetailRow label="CAC number" value={customer.cac_registration_number} mono />
          <DetailRow label="VAT number" value={customer.vat_number} mono />
          <DetailRow label="NRS buyer identifier" value={customer.nrs_buyer_identifier || 'Not configured — integration pending'} />
        </dl>
      </DetailSection>

      <DetailSection icon={ContactRound} title="Primary contact" description="Contact person recorded for this customer.">
        <dl className={styles.details}>
          <DetailRow label="Name" value={customer.contact_person_name} />
          <DetailRow label="Email" value={customer.contact_person_email} />
          <DetailRow label="Phone" value={customer.contact_person_phone} mono />
        </dl>
      </DetailSection>

      <DetailSection icon={Building2} title="Billing address" description="Address associated with this customer.">
        <dl className={styles.details}>
          <DetailRow label="Address line 1" value={customer.billing_address_line_1} />
          <DetailRow label="Address line 2" value={customer.billing_address_line_2} />
          <DetailRow label="City / State" value={[customer.city, customer.state].filter(Boolean).join(', ')} />
          <DetailRow label="NRS postal zone" value={customer.nrs_postal_zone} mono />
          <DetailRow label="NRS state code" value={customer.nrs_state_code} mono />
          <DetailRow label="NRS LGA code" value={customer.nrs_lga_code} mono />
          <DetailRow label="Country" value={countryLabel(customer.country)} />
        </dl>
      </DetailSection>

      <DetailSection icon={CalendarClock} title="Record summary" description="Dates and internal team notes.">
        <dl className={styles.details}>
          <DetailRow label="Created" value={formatDate(customer.created_at)} mono />
          <DetailRow label="Last updated" value={formatDate(customer.updated_at)} mono />
        </dl>
        <div className={styles.notes}>
          <span><ReceiptText size={15} aria-hidden="true" /> Internal notes</span>
          <p>{customer.notes || 'No internal notes have been added for this customer.'}</p>
        </div>
        {showActions && <button className={styles.archive} type="button" onClick={() => setConfirmArchive(true)}><Archive size={15} aria-hidden="true" /> Archive this customer</button>}
      </DetailSection>
    </div>

    {canManage && <CustomerFormDrawer open={editing} customer={customer} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh() }} />}
    <ConfirmDialog open={confirmArchive} title="Archive customer?" message={`Archive ${customerName}? Historical invoices remain preserved, but this customer cannot be selected for new invoices.`} confirmLabel="Archive customer" variant="danger" loading={archiving} onConfirm={archive} onClose={() => !archiving && setConfirmArchive(false)} />
  </div>
}
