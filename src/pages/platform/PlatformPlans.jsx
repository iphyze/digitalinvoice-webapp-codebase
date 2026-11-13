import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackagePlus, RefreshCw, CalendarDays, CalendarRange, CheckCircle2, CirclePause, Package } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import Checkbox from '../../components/forms/Checkbox'
import Switch from '../../components/forms/Switch'
import Modal from '../../components/overlays/Modal'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { assertCurrencyAmounts, count, date, list, money, permission, unwrap } from './platformModel'
import {
  BILLING_INTERVALS, PLAN_STATUS_OPTIONS, billingPageParams, pageMeta, planForm,
  planPayload, previewPlanPrice, isPremiumPlan, features, limits,
} from './billingModel'
import styles from './PlatformAdmin.module.css'
import billing from './PlatformBilling.module.css'

const metricIcons = {
  'total_plans': Package,
  'active_plans': CheckCircle2,
  'inactive_plans': CirclePause,
  'monthly_plans': CalendarDays,
  'annual_plans': CalendarRange,
}

export default function PlatformPlans() {
  const [params, setParams] = useSearchParams()
  const query = billingPageParams(params, ['search', 'status', 'billing_interval'])
  const search = query.search || ''
  const status = query.status || ''
  const interval = query.billing_interval || ''
  const [filters, setFilters] = useState({ search, status, billing_interval: interval })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(planForm())
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toggle, setToggle] = useState(null)
  const actor = useAuthStore((s) => s.user)
  const access = useAuthStore((s) => s.platformAccess)
  const canManage = permission(access, actor, 'platform.plans.manage')
  const toast = useToastStore((s) => s.showToast)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = unwrap(await platformService.plans({ ...billingPageParams(params, ['search', 'status', 'billing_interval']) }), ['summary', 'plans', 'pagination'])
      list(response.plans).forEach((plan) => assertCurrencyAmounts(plan.lifetime_revenue_by_currency))
      setData(response)
    }
    catch (err) { setData(null); setError(getErrorMessage(err, 'Unable to load subscription plans.')) }
    finally { setLoading(false) }
  }, [params, revision])
  useEffect(() => { load() }, [load])
  const changeParams = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, val]) => val !== '' && val !== null && val !== undefined)))
  const goPage = (page) => changeParams({ ...query, page })
  const showForm = (plan = null) => { setEditing(plan || 'new'); setForm(planForm(plan)); setErrors({}); setActionError('') }
  const update = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setErrors((old) => ({ ...old, [key]: undefined })) }
  const editEntitlement = (section, key, value) => setForm((old) => ({ ...old, entitlements: { ...old.entitlements, [section]: { ...old.entitlements[section], [key]: value } } }))
  const save = async (event) => {
    event.preventDefault()
    if (!canManage || busy) return
    const result = planPayload(form)
    setErrors(result.errors)
    if (!result.payload) return
    setBusy(true); setActionError('')
    try {
      if (form.id) await platformService.updatePlan(result.payload)
      else await platformService.createPlan(result.payload)
      toast(form.id ? 'Plan updated successfully.' : 'Plan created successfully.', 'success')
      setEditing(null); setRevision((n) => n + 1)
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to save subscription plan.')) }
    finally { setBusy(false) }
  }
  const toggleStatus = async () => {
    if (!toggle || !canManage) return
    setBusy(true); setActionError('')
    try {
      // Update endpoint merges supplied fields with the stored plan, retaining its pricing and entitlements.
      await platformService.updatePlan({ id: toggle.id, is_active: !toggle.is_active })
      toast(toggle.is_active ? 'Plan deactivated.' : 'Plan activated.', 'success')
      setToggle(null); setRevision((n) => n + 1)
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to change plan status.')) }
    finally { setBusy(false) }
  }
  const rows = list(data?.plans)
  const pg = pageMeta(data)
  const premium = isPremiumPlan(form)
  const columns = [
    { key: 'plan', header: 'Plan', cell: (p) => <div className={styles.rowTitle}><strong>{p.name}</strong><span className="ref">{p.code} · {p.currency}</span></div> },
    { key: 'price', header: 'Price', cell: (p) => <div className={styles.rowTitle}><strong className="num">{p.is_contact_plan ? 'Contact us' : money(p.amount, p.currency)}</strong><span>{p.is_contact_plan ? 'Custom pricing' : `${p.discount_percent > 0 ? `${p.discount_percent}% discount · ` : ''}${p.billing_interval}`}</span></div> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.is_active ? 'active' : 'inactive'} /> },
    { key: 'active', header: 'Active subscriptions', cell: (p) => <strong className="num">{count(p.active_subscription_count)}</strong> },
    { key: 'revenue', header: 'Paid revenue by currency', cell: (p) => <div className={styles.rowTitle}>{list(p.lifetime_revenue_by_currency).length ? p.lifetime_revenue_by_currency.map((entry) => <span className="num" key={entry.currency}>{money(entry.amount, entry.currency)}</span>) : <span>No payments</span>}</div> },
    { key: 'updated', header: 'Updated', cell: (p) => <span className="num">{date(p.updated_at)}</span> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Plans" description="Manage subscription pricing, billing intervals and workspace feature entitlements." actions={<div className={styles.actions}><Button variant="secondary" icon={RefreshCw} disabled={loading} onClick={() => setRevision((n) => n + 1)}>Refresh</Button>{canManage && <Button icon={PackagePlus} onClick={() => showForm()}>Create plan</Button>}</div>} />
    {error && <Alert tone="danger" title="Plans unavailable">{error} <Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>Retry</Button></Alert>}
    <div className={styles.stats}>{[['Total plans', 'total_plans'], ['Active plans', 'active_plans'], ['Inactive plans', 'inactive_plans'], ['Monthly plans', 'monthly_plans'], ['Annual plans', 'annual_plans']].map(([title, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[title]} label={title} value={loading || error ? '—' : count(data?.summary?.[key])} />)}</div>
    <section className={styles.panel}>
      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); changeParams({ ...filters, limit: query.limit, page: 1 }) }}>
        <TextField className={styles.search} label="Search plans" placeholder="Plan name, code or Paystack reference" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
        <Select label="Status" value={filters.status} options={PLAN_STATUS_OPTIONS} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} />
        <Select label="Billing" value={filters.billing_interval} options={[{ value: '', label: 'All intervals' }, ...BILLING_INTERVALS]} onChange={(value) => setFilters((prev) => ({ ...prev, billing_interval: value }))} />
        <Button type="submit" disabled={loading}>Apply</Button><Button variant="secondary" onClick={() => { setFilters({ search: '', status: '', billing_interval: '' }); setParams({}) }}>Clear</Button>
      </form>
      {!error && <><DataTable columns={columns} rows={rows} loading={loading} actions={canManage ? (item) => <div className={styles.rowActions}><Button variant="secondary" size="sm" onClick={() => showForm(item)}>Edit</Button><Button variant={item.is_active ? 'danger' : 'secondary'} size="sm" onClick={() => { setActionError(''); setToggle(item) }}>{item.is_active ? 'Deactivate' : 'Activate'}</Button></div> : undefined} empty={<div className={styles.empty}><PackagePlus size={25} /><strong>No plans found</strong><p>Try changing the filters or create a plan.</p></div>} />
        {data && <Pagination page={pg.page} limit={pg.limit} total={pg.total} totalPages={pg.totalPages} disabled={loading} onPageChange={goPage} onLimitChange={(limit) => changeParams({ ...query, page: 1, limit })} noun="plans" />}
      </>}
      <p className={styles.note}>Plan pricing is configured by the platform. Premium contact plans do not use Paystack pricing. Published prices and entitlements affect new subscriptions; existing subscriptions are managed separately.</p>
    </section>
    <Modal open={Boolean(editing)} title={form.id ? 'Edit subscription plan' : 'Create subscription plan'} description="Configure pricing, billing and access permissions." size="lg" busy={busy} onClose={() => !busy && setEditing(null)} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="platform-plan-form" loading={busy}>{form.id ? 'Save changes' : 'Create plan'}</Button></div>}>
      <form id="platform-plan-form" className={styles.form} noValidate onSubmit={save}>
        <div className={styles.formGrid}><TextField required label="Plan name" maxLength={100} value={form.name} error={errors.name} onChange={(event) => update('name', event.target.value)} /><TextField label="Plan code" maxLength={60} hint="Leave blank to derive a code from the name and interval." value={form.code} error={errors.code} onChange={(event) => update('code', event.target.value)} /></div>
        <Textarea label="Description" rows={2} maxLength={1000} value={form.description} error={errors.description} onChange={(event) => update('description', event.target.value)} />
        <div className={styles.formGrid}><Select label="Billing interval" options={BILLING_INTERVALS} value={form.billing_interval} error={errors.billing_interval} onChange={(value) => { update('billing_interval', value); if (value === 'monthly') update('discount_percent', '0') }} /><Select label="Entitlement tier" value={form.entitlements.tier} options={[{ value: 'starter', label: 'Starter' }, { value: 'professional', label: 'Professional' }, { value: 'business', label: 'Business' }, { value: 'premium', label: 'Premium (contact us)' }]} onChange={(tier) => setForm((old) => ({ ...old, entitlements: { ...old.entitlements, tier } }))} /></div>
        {premium ? <Alert tone="info">Premium contact plans have no online price or payment plan. All feature entitlements are unlimited and controlled by the backend.</Alert> : <>
          <div className={styles.formGrid}><TextField required label="Actual plan price (₦)" inputMode="decimal" value={form.actual_amount} error={errors.actual_amount} onChange={(event) => update('actual_amount', event.target.value)} /><TextField label="Discount (%)" inputMode="decimal" disabled={form.billing_interval === 'monthly'} value={form.billing_interval === 'monthly' ? '0' : form.discount_percent} error={errors.discount_percent} onChange={(event) => update('discount_percent', event.target.value)} /></div>
          <p className={styles.note}>Estimated client price: <strong className="num">{Number.isFinite(previewPlanPrice(form)) ? money(previewPlanPrice(form), form.currency) : '—'}</strong>. Final pricing is calculated by the server.</p>
          <div className={styles.formGrid}><TextField label="Currency" maxLength={3} value={form.currency} error={errors.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /><TextField label="Paystack plan code (optional)" maxLength={100} value={form.paystack_plan_code} error={errors.paystack_plan_code} onChange={(event) => update('paystack_plan_code', event.target.value)} /></div>
        </>}
        <Textarea label="Feature lines" rows={4} value={form.features_text} error={errors.features_text} onChange={(event) => update('features_text', event.target.value)} hint="One customer-facing feature per line (maximum 30)." />
        {!premium && <><h3 className={billing.sectionTitle}>Workspace feature access</h3><div className={billing.featureGrid}>{features.map((feature) => <Checkbox key={feature.key} label={feature.label} description={feature.category} checked={Boolean(form.entitlements.features[feature.key])} onChange={(event) => editEntitlement('features', feature.key, event.target.checked)} />)}</div><h3 className={billing.sectionTitle}>Plan limits</h3><div className={styles.formGrid}>{limits.map((limit) => <TextField key={limit.key} label={limit.label} type="number" min="-1" step="1" hint="-1 means unlimited" value={form.entitlements.limits[limit.key]} error={errors[`limit_${limit.key}`]} onChange={(event) => editEntitlement('limits', limit.key, event.target.value)} />)}</div></>}
        <div className={styles.formGrid}><TextField label="Display order" type="number" min="0" step="1" value={form.sort_order} error={errors.sort_order} onChange={(event) => update('sort_order', event.target.value)} /><Switch label="Active plan" description="Only active plans are offered for new subscriptions." checked={form.is_active} onChange={(value) => update('is_active', value)} /></div>
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>
    </Modal>
    <ConfirmDialog open={Boolean(toggle)} title={toggle?.is_active ? 'Deactivate plan?' : 'Activate plan?'} message={toggle ? `This will ${toggle.is_active ? 'hide the plan from new subscriptions. Existing subscriptions are not automatically cancelled' : 'make the plan available again'}: ${toggle.name}.` : ''} confirmLabel={toggle?.is_active ? 'Deactivate' : 'Activate'} variant={toggle?.is_active ? 'danger' : 'primary'} loading={busy} onConfirm={toggleStatus} onClose={() => !busy && setToggle(null)} />
    {toggle && actionError && <Alert tone="danger">{actionError}</Alert>}
  </main>
}
