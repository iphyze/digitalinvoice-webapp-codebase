import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Building2, CreditCard, RefreshCw, UsersRound, Wallet, CalendarClock, ShieldCheck } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import Skeleton from '../../components/ui/Skeleton'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import { getErrorMessage } from '../../utils/httpError'
import { count, date, label, list, money, permission, unwrap } from './platformModel'
import styles from './PlatformAdmin.module.css'

const metricIcons = {
  'total_clients': Building2,
  'active_clients': ShieldCheck,
  'active_platform_users': UsersRound,
  'active_subscriptions': CreditCard,
  'expiring_soon': CalendarClock,
  'payment_issues': Wallet,
}

export default function PlatformDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const access = useAuthStore((s) => s.platformAccess)
  const user = useAuthStore((s) => s.user)
  const can = (p) => permission(access, user, p)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setDashboard(unwrap(await platformService.dashboard(), ['cards', 'subscription_breakdown', 'recent_clients', 'recent_payments', 'recent_activity', 'currency_breakdown'])) }
    catch (err) { setDashboard(null); setError(getErrorMessage(err, 'Unable to load platform overview.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const cards = dashboard?.cards || {}
  const currencyRows = list(dashboard?.currency_breakdown)
  const metrics = [
    ['Clients', 'total_clients', Building2], ['Active clients', 'active_clients', Building2],
    ['Platform users', 'active_platform_users', UsersRound], ['Active subscriptions', 'active_subscriptions', CreditCard],
    ['Expiring in 14 days', 'expiring_soon', CreditCard], ['Payment issues', 'payment_issues', Wallet],
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Platform dashboard" description="Overview of customer organisations, subscriptions, access and billing." actions={<Button icon={RefreshCw} variant="secondary" loading={loading} onClick={load}>Refresh</Button>} />
    {error && <Alert tone="danger" title="Platform overview unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert>}
    {loading ? <div className={styles.stats}>{metrics.map(([name]) => <Skeleton key={name} width="100%" height="96px" />)}</div> : dashboard && <>
      <section className={styles.stats} aria-label="Platform metrics">{metrics.map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={count(cards[key])} />)}</section>
      <section className={styles.panel} aria-labelledby="currency-overview-heading">
        <div className={styles.panelHeading}><div><h2 id="currency-overview-heading"><Wallet size={17} aria-hidden="true" /> Billing by currency</h2><p>Recorded subscription revenue and monthly recurring value, without FX conversions</p></div></div>
        {currencyRows.length ? <ul className={styles.entries}>
          {currencyRows.map((entry) => <li key={entry.currency}>
            <div className={styles.entryMain}><strong className="ref">{entry.currency}</strong><small>{count(entry.paid_transactions)} paid transactions · {count(entry.recurring_clients)} recurring clients</small></div>
            <div className={styles.entryAside}><strong className="num">{money(entry.month_revenue, entry.currency)} this month</strong><small className="num">Lifetime {money(entry.lifetime_revenue, entry.currency)} · MRR {money(entry.mrr, entry.currency)}</small></div>
          </li>)}
        </ul> : <div className={styles.empty}><Wallet size={25} /><strong>No subscription revenue yet</strong><p>Totals appear separately for each recorded currency.</p></div>}
      </section>
      <p className={styles.note}>Each monetary total is in its own currency. No amounts in different currencies are added together. Last updated: {date(dashboard.generated_at)}.</p>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="platform-recent-clients"><div className={styles.panelHeading}><div><h2 id="platform-recent-clients"><Building2 size={17} aria-hidden="true" /> Recent clients</h2><p>Eight most recently created client organisations</p></div>{can('platform.clients.view') && <Link className={styles.link} to="/platform/clients">View all <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {list(dashboard.recent_clients).length ? <ul className={styles.entries}>{dashboard.recent_clients.map((client) => <li key={client.id}><div className={styles.entryMain}><strong>{can('platform.clients.view') ? <Link className={styles.link} to={`/platform/clients/${client.id}`}>{client.name}</Link> : client.name}</strong><small>{client.owner_email || client.business_email || 'No contact email'} · {date(client.created_at)}</small></div><StatusBadge status={client.status} /></li>)}</ul> : <div className={styles.empty}><Building2 size={25} /><strong>No clients yet</strong><p>Client workspaces appear here as they register.</p></div>}
        </section>
        <section className={styles.panel} aria-labelledby="platform-subscriptions"><div className={styles.panelHeading}><div><h2 id="platform-subscriptions"><CreditCard size={17} aria-hidden="true" /> Subscription breakdown</h2><p>Current subscription per client</p></div>{can('platform.subscriptions.view') && <Link className={styles.link} to="/platform/subscriptions">Subscriptions <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {list(dashboard.subscription_breakdown).length ? <ul className={styles.entries}>{dashboard.subscription_breakdown.map((item) => <li key={item.status}><span><StatusBadge status={item.status} /></span><strong className="num">{count(item.total)}</strong></li>)}</ul> : <div className={styles.empty}><CreditCard size={25} /><strong>No subscriptions yet</strong><p>Subscription statuses will appear here.</p></div>}
        </section>
        <section className={styles.panel} aria-labelledby="platform-payments"><div className={styles.panelHeading}><div><h2 id="platform-payments"><Wallet size={17} aria-hidden="true" /> Recent subscription payments</h2><p>Latest eight payment records</p></div>{can('platform.revenue.view') && <Link className={styles.link} to="/platform/revenue">Revenue <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {list(dashboard.recent_payments).length ? <ul className={styles.entries}>{dashboard.recent_payments.map((item) => <li key={item.id}><div className={styles.entryMain}><strong>{item.organization_name || 'Organisation'}</strong><small className="ref">{item.payment_reference || 'No reference'} · {date(item.paid_at || item.created_at)}</small></div><div className={styles.entryAside}><strong className="num">{money(item.amount, item.currency || 'NGN')}</strong><StatusBadge status={item.status} /></div></li>)}</ul> : <div className={styles.empty}><Wallet size={25} /><strong>No payment records</strong></div>}
        </section>
        <section className={styles.panel} aria-labelledby="platform-activity"><div className={styles.panelHeading}><div><h2 id="platform-activity"><Activity size={17} aria-hidden="true" /> Recent activity</h2><p>Platform events · latest ten</p></div>{can('platform.activity.view') && <Link className={styles.link} to="/platform/activity">Activity log <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {list(dashboard.recent_activity).length ? <ul className={styles.entries}>{dashboard.recent_activity.map((item) => <li key={item.id}><div className={styles.entryMain}><strong>{item.description || label(item.action)}</strong><small>{item.user_name || 'System'} · {item.organization_name || 'Platform'} · {date(item.created_at)}</small></div></li>)}</ul> : <div className={styles.empty}><Activity size={25} /><strong>No activity yet</strong></div>}
        </section>
      </div>
      <p className={styles.note}>All figures are internal DigitalInvoice operational records. NRS onboarding or live submission is not implied.</p>
    </>}
  </main>
}
