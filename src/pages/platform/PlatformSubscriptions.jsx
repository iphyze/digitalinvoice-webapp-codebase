import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BellRing, CreditCard, RefreshCw, AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck, Webhook } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { assertCurrencyAmounts, count, date, list, money, permission, unwrap } from './platformModel'
import PlatformCurrencyBreakdown from './PlatformCurrencyBreakdown'
import { billingPageParams, pageMeta, SUBSCRIPTION_STATUS_OPTIONS, SUBSCRIPTION_PERIOD_OPTIONS } from './billingModel'
import styles from './PlatformAdmin.module.css'

const metricIcons = {
  'total_subscriptions': CreditCard,
  'active_subscriptions': ShieldCheck,
  'healthy_subscriptions': CheckCircle2,
  'at_risk_subscriptions': AlertTriangle,
  'expiring_soon': CalendarClock,
  'Expiry sync needed': RefreshCw,
  'Failed subscription payments': CreditCard,
  'Unprocessed Paystack webhooks': Webhook,
  'Failed webhooks': AlertTriangle,
}

export default function PlatformSubscriptions() {
  const [params, setParams] = useSearchParams()
  const query = billingPageParams(params, ['search', 'status', 'plan_id', 'period'])
  const [draft, setDraft] = useState({ search: query.search || '', status: query.status || '', plan_id: query.plan_id || '', period: query.period || '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const actor = useAuthStore((s) => s.user)
  const access = useAuthStore((s) => s.platformAccess)
  const canManage = permission(access, actor, 'platform.subscriptions.manage')
  const toast = useToastStore((s) => s.showToast)
  const change = (newParams) => setParams(Object.fromEntries(Object.entries(newParams).filter(([, val]) => val !== '' && val !== undefined && val !== null)))
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = unwrap(await platformService.subscriptions(billingPageParams(params, ['search', 'status', 'plan_id', 'period'])), ['summary', 'subscriptions', 'pagination', 'plans', 'lifecycle'])
      assertCurrencyAmounts(response.summary?.monthly_recurring_revenue_by_currency)
      setData(response)
    }
    catch (err) { setData(null); setError(getErrorMessage(err, 'Unable to load subscriptions.')) }
    finally { setLoading(false) }
  }, [params, revision])
  useEffect(() => { load() }, [load])
  const action = async () => {
    if (!canManage || !confirm) return
    setBusy(true); setActionError('')
    try {
      const response = confirm === 'sync' ? await platformService.syncSubscriptionLifecycle() : await platformService.sendSubscriptionNotifications()
      const result = unwrap(response)
      const sent = result.notifications?.sent
      toast(confirm === 'sync' ? `Expiry synchronization completed; ${count(result.sync?.expired_count)} subscriptions updated.` : `Reminder sweep completed; ${count(sent)} reminders sent.`, 'success')
      setConfirm(''); setRevision((n) => n + 1)
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to complete lifecycle operation.')) }
    finally { setBusy(false) }
  }
  const rows = list(data?.subscriptions)
  const pg = pageMeta(data)
  const cards = [['Subscriptions', 'total_subscriptions'], ['Active', 'active_subscriptions'], ['Healthy (incl. trial)', 'healthy_subscriptions'], ['At risk', 'at_risk_subscriptions'], ['Expiring soon', 'expiring_soon']]
  const lifecycle = data?.lifecycle || {}
  const cols = [
    { key: 'organization', header: 'Organisation', cell: (item) => <div className={styles.rowTitle}><Link to={`/platform/subscriptions/${item.id}`} className={styles.link}>{item.organization_name || 'Client organisation'}</Link><span>{item.owner_email || item.organization_email || '—'}</span></div> },
    { key: 'plan', header: 'Plan', cell: (item) => <div className={styles.rowTitle}><strong>{item.plan_name}</strong><span>{item.billing_interval}</span></div> },
    { key: 'amount', header: 'Plan price', cell: (item) => <strong className="num">{money(item.plan_amount, item.currency)}</strong> },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.status} /> },
    { key: 'expiry', header: 'Current period ends', cell: (item) => <span className="num">{date(item.current_period_end)}</span> },
    { key: 'provider', header: 'Provider', cell: (item) => item.provider || '—' },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform billing" title="Subscriptions" description="Review client subscriptions and their billing lifecycle; inspect records before changing customer access." actions={<div className={styles.actions}><Button variant="secondary" icon={RefreshCw} disabled={loading || busy} onClick={() => setRevision((n) => n + 1)}>Refresh</Button>{canManage && <><Button variant="secondary" disabled={busy} onClick={() => { setActionError(''); setConfirm('notify') }} icon={BellRing}>Send reminders</Button><Button disabled={busy} icon={RefreshCw} onClick={() => { setActionError(''); setConfirm('sync') }}>Sync expiry</Button></>}</div>} />
    {error && <Alert tone="danger" title="Subscriptions unavailable">{error} <Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>Try again</Button></Alert>}
    <div className={styles.stats}>{cards.map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={loading || error ? '—' : count(data?.summary?.[key])} />)}</div>
    {data && !error && <section className={styles.panel}><div className={styles.panelHeading}><div><h2><ShieldCheck size={17} aria-hidden="true" /> Billing health</h2><p>These operational counters are platform-wide, not filtered by the table.</p></div></div>
      <div className={styles.stats}>{[
        ['Expiry sync needed', lifecycle.subscriptions?.needs_expiry_sync],
        ['Failed subscription payments', lifecycle.payments?.failed],
        ['Unprocessed Paystack webhooks', lifecycle.webhooks?.unprocessed],
        ['Failed webhooks', lifecycle.webhooks?.failed],
      ].map(([name, value]) => <SummaryStat key={name} icon={metricIcons[name]} label={name} value={count(value)} />)}</div>
      <p className={styles.note}>Subscription lifecycle actions can update workspace access; reminder dispatch may send emails. MRR is calculated separately for each plan currency.</p>
    </section>}
    {data && !error && <PlatformCurrencyBreakdown title="Monthly recurring revenue by currency" rows={data.summary.monthly_recurring_revenue_by_currency} note="Platform-wide active, trial and non-renewing subscriptions; not filtered by the table. No currency conversion is assumed." />}
    <section className={styles.panel}>
      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); change({ ...draft, limit: query.limit, page: 1 }) }}>
        <TextField className={styles.search} label="Search subscriptions" placeholder="Organisation, plan, owner or reference" value={draft.search} onChange={(event) => setDraft((old) => ({ ...old, search: event.target.value }))} />
        <Select label="Status" options={SUBSCRIPTION_STATUS_OPTIONS} value={draft.status} onChange={(value) => setDraft((old) => ({ ...old, status: value }))} />
        <Select label="Plan" value={draft.plan_id} options={[{ value: '', label: 'All plans' }, ...list(data?.plans).map((p) => ({ value: String(p.id), label: p.name }))]} onChange={(value) => setDraft((old) => ({ ...old, plan_id: value }))} />
        <Select label="Expiry window" options={SUBSCRIPTION_PERIOD_OPTIONS} value={draft.period} onChange={(value) => setDraft((old) => ({ ...old, period: value }))} />
        <Button type="submit" disabled={loading}>Apply</Button><Button variant="secondary" onClick={() => { setDraft({ search: '', status: '', plan_id: '', period: '' }); setParams({}) }}>Clear</Button>
      </form>
      {!error && <><DataTable columns={cols} rows={rows} loading={loading} actions={(item) => <Button size="sm" variant="secondary" to={`/platform/subscriptions/${item.id}`}>Details</Button>} empty={<div className={styles.empty}><CreditCard size={25} /><strong>No matching subscriptions</strong><p>Try other filters.</p></div>} />
        {data && <Pagination page={pg.page} limit={pg.limit} total={pg.total} totalPages={pg.totalPages} disabled={loading} noun="subscriptions" onPageChange={(page) => change({ ...query, page })} onLimitChange={(limit) => change({ ...query, limit, page: 1 })} />}
      </>}
    </section>
    <ConfirmDialog open={Boolean(confirm)} title={confirm === 'sync' ? 'Synchronize expired subscriptions?' : 'Send subscription reminders?'} message={confirm === 'sync' ? 'Check expired billing periods, update subscription statuses and possibly restrict client workspace access. This action is audited.' : 'Run the subscription notification sweep. Eligible recipients may receive reminder emails; repeat notices are de-duplicated by the backend.'} confirmLabel={confirm === 'sync' ? 'Run expiry sync' : 'Send eligible reminders'} loading={busy} variant={confirm === 'sync' ? 'danger' : 'primary'} onConfirm={action} onClose={() => !busy && setConfirm('')} />
    {confirm && actionError && <Alert tone="danger">{actionError}</Alert>}
  </main>
}
