import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowUpRight, Boxes, CalendarRange, CreditCard, FileCheck2,
  FileClock, FilePlus2, ReceiptText, RefreshCw, ShieldAlert, ShieldCheck, UsersRound, WalletCards, ChartNoAxesCombined } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Skeleton from '../../components/ui/Skeleton'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/data/StatCard'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import dashboardService from '../../services/dashboardService'
import useAuthStore from '../../stores/useAuthStore'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission, hasEntitlement } from '../../utils/entitlements'
import { getErrorMessage } from '../../utils/httpError'
import {
  DASHBOARD_CURRENCIES, DASHBOARD_PERIOD_OPTIONS, createDashboardFilters, getDashboardPresetPeriod,
} from '../../utils/dashboardFilters'
import {
  dashboardActionName, dashboardCount, dashboardDate, dashboardMoney, dashboardPercent,
  dashboardPeriodError, readDashboardActivity, readDashboardSummary, readDashboardTrends,
} from './dashboardModel'
import styles from './Dashboard.module.css'

const DashboardTrendChart = lazy(() => import('./DashboardTrendChart'))

const metricConfig = [
  { id: 'approved_invoices', label: 'Approved invoices', icon: FileCheck2, tone: 'blue', countLabel: 'approved' },
  { id: 'payments_received', label: 'Collections received', icon: WalletCards, tone: 'teal', countLabel: 'receipts' },
  { id: 'outstanding', label: 'Outstanding balance', icon: ReceiptText, tone: 'amber', countLabel: 'invoices' },
  { id: 'overdue', label: 'Overdue receivables', icon: AlertTriangle, tone: 'red', countLabel: 'overdue' },
  { id: 'pending_approvals', label: 'Pending approval', icon: FileClock, tone: 'violet', countLabel: 'invoices' },
  { id: 'tax_billed', label: 'VAT billed', icon: ShieldCheck, tone: 'green', countLabel: null },
]

const safeList = (value) => Array.isArray(value) ? value : []

const loadError = (settlement, reader, fallback) => {
  try {
    if (settlement.status !== 'fulfilled') throw settlement.reason
    return { data: reader(settlement.value), error: '' }
  } catch (error) {
    return { data: null, error: getErrorMessage(error, fallback) }
  }
}

export default function Dashboard() {
  const permissions = useAuthStore((state) => state.permissions)
  const entitlements = useAuthStore((state) => state.entitlements)
  const canAccess = useCallback((permission) => hasPermission(permissions, permission) && hasEntitledPermission(entitlements, permission), [permissions, entitlements])
  const [applied, setApplied] = useState(() => createDashboardFilters())
  const [draft, setDraft] = useState(() => createDashboardFilters())
  const [dateError, setDateError] = useState('')
  const [revision, setRevision] = useState(0)
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState(null)
  const [activity, setActivity] = useState(null)
  const [errors, setErrors] = useState({ summary: '', trends: '', activity: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setSummary(null)
    setTrends(null)
    setActivity(null)
    setErrors({ summary: '', trends: '', activity: '' })

    const params = { from: applied.from, to: applied.to, currency: applied.currency }
    Promise.allSettled([
      dashboardService.summary(params),
      dashboardService.trends(params),
      dashboardService.recentActivity({ limit: 8 }),
    ]).then(([summaryResult, trendsResult, activityResult]) => {
      if (!active) return
      const first = loadError(summaryResult, readDashboardSummary, 'Unable to load dashboard summary.')
      const second = loadError(trendsResult, readDashboardTrends, 'Unable to load invoice trends.')
      const third = loadError(activityResult, readDashboardActivity, 'Unable to load recent activity.')
      setSummary(first.data)
      setTrends(second.data)
      setActivity(third.data)
      setErrors({ summary: first.error, trends: second.error, activity: third.error })
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applied, revision])

  const choosePreset = (value) => {
    setDateError('')
    setDraft((current) => value === 'custom'
      ? { ...current, preset: 'custom' }
      : { ...current, preset: value, ...getDashboardPresetPeriod(value) })
  }
  const updateDate = (field, value) => {
    setDateError('')
    setDraft((current) => ({ ...current, preset: 'custom', [field]: value }))
  }
  const apply = (event) => {
    event.preventDefault()
    const issue = dashboardPeriodError(draft)
    if (issue) { setDateError(issue); return }
    setApplied({ ...draft })
    setRevision((value) => value + 1)
  }

  const cards = summary?.cards
  const currency = summary?.currency || applied.currency
  const recentInvoices = safeList(summary?.recent_invoices)
  const recentPayments = safeList(summary?.recent_payments)
  const isEmpty = summary && Number(cards?.approved_invoices?.count || 0) === 0
    && Number(cards?.payments_received?.count || 0) === 0
    && Number(cards?.active_customers || 0) === 0 && Number(cards?.active_items || 0) === 0
  const points = trends?.points || []
  const activeTrend = points.some((point) => point.invoiced > 0 || point.collected > 0)
  const trendUnit = trends?.granularity === 'day' ? 'Daily' : 'Monthly'

  const metrics = useMemo(() => metricConfig.map((config) => {
    const data = cards?.[config.id]
    return {
      ...config,
      value: dashboardMoney(typeof data === 'object' ? data?.amount : data, currency),
      note: config.countLabel ? `${dashboardCount(data?.count)} ${config.countLabel}` : 'Internal tax records',
    }
  }), [cards, currency])

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A clear view of invoicing performance, collections and compliance readiness."
        actions={<div className={styles.headingActions}>
          {canAccess('invoices.create') ? <Button to="/app/invoices/new" size="sm" icon={FilePlus2}>Create invoice</Button> : null}
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setRevision((value) => value + 1)} loading={loading}>Refresh</Button>
        </div>}
      />

      <form className={styles.filters} onSubmit={apply} aria-label="Dashboard reporting filters">
        <div className={styles.filterFields}>
          <Select label="Reporting period" value={draft.preset} onChange={choosePreset} options={DASHBOARD_PERIOD_OPTIONS} />
          <DatePicker label="From" value={draft.from} onChange={(value) => updateDate('from', value)} />
          <DatePicker label="To" value={draft.to} onChange={(value) => updateDate('to', value)} />
          <Select label="Currency" value={draft.currency} onChange={(currencyValue) => setDraft((current) => ({ ...current, currency: currencyValue }))} options={DASHBOARD_CURRENCIES} />
          <Button type="submit" className={styles.applyButton} disabled={loading} icon={CalendarRange}>Apply filters</Button>
        </div>
        {dateError ? <p className={styles.formError} role="alert">{dateError}</p> : null}
        <p className={styles.periodNote}>
          Showing {dashboardDate(summary?.period?.from || applied.from)} – {dashboardDate(summary?.period?.to || applied.to)} · {currency}. Monetary figures are for one currency only.
        </p>
      </form>

      {errors.summary && !loading ? <Alert tone="danger" title="Dashboard summary unavailable" className={styles.message}>
        {errors.summary} <button className={styles.textButton} type="button" onClick={() => setRevision((value) => value + 1)}>Try again</button>
      </Alert> : null}

      {(summary || loading) && <>
        <section aria-label="Financial overview" className={styles.metricGrid}>
          {metrics.map((metric) => <StatCard key={metric.id} icon={metric.icon} label={metric.label} value={metric.value} note={loading ? '' : metric.note} tone={metric.tone} loading={loading} />)}
        </section>

        {!loading && <section className={styles.insights} aria-label="Additional workspace metrics">
          <SummaryStat icon={ChartNoAxesCombined} label="Collection rate" value={dashboardPercent(cards?.collection_rate_percent)} note="Allocated receipts ÷ approved invoice value in this period" tone="teal" />
          <SummaryStat icon={UsersRound} label="Active customers" value={dashboardCount(cards?.active_customers)} note="Across your workspace" tone="blue" />
          <SummaryStat icon={Boxes} label="Products & services" value={dashboardCount(cards?.active_items)} note="Active catalogue items" tone="violet" />
          <SummaryStat icon={FileClock} label="Awaiting NRS integration" value={dashboardCount(cards?.nrs_awaiting_submission?.count)} note="Internal approved invoices, not submitted" tone="amber" />
        </section>}

        {!loading && isEmpty && <section className={styles.welcome} aria-labelledby="dashboard-welcome-heading">
          <div>
            <span className={styles.eyebrow}>Getting started</span>
            <h2 id="dashboard-welcome-heading">Build your first invoice</h2>
            <p>Add your customers and catalogue items, then create an invoice to see performance here.</p>
          </div>
          <div className={styles.quickLinks}>
            {canAccess('customers.view') && <Link to="/app/customers">Customers <ArrowUpRight size={15} aria-hidden="true" /></Link>}
            {canAccess('catalogue.view') && <Link to="/app/catalogue">Products & services <ArrowUpRight size={15} aria-hidden="true" /></Link>}
            {canAccess('invoices.create') && <Link to="/app/invoices/new">Create invoice <ArrowUpRight size={15} aria-hidden="true" /></Link>}
          </div>
        </section>}
      </>}

      <div className={styles.middleGrid}>
        <section className={styles.panel} aria-labelledby="dashboard-chart-heading">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="dashboard-chart-heading"><ChartNoAxesCombined size={18} aria-hidden="true" /> Invoices and collections</h2>
              <p>{trendUnit} comparison · {currency}</p>
            </div>
            <span className={styles.chartLegend}><i className={styles.legendInvoice} /> Invoices <i className={styles.legendPayment} /> Payments</span>
          </div>
          {loading ? <Skeleton width="100%" height="290px" radius="var(--radius-card)" /> : errors.trends ?
            <Alert tone="warning" title="Trends unavailable">{errors.trends} <button type="button" className={styles.textButton} onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert> :
            !points.length || !activeTrend ? <div className={styles.empty}><Activity size={28} aria-hidden="true" /><strong>No transactions in this period</strong><p>Approved invoice and payment trends will appear as records are posted.</p></div> :
              <Suspense fallback={<Skeleton width="100%" height="290px" radius="var(--radius-card)" />}>
                <DashboardTrendChart points={points} currency={currency} />
                <table className={styles.screenReaderTable}>
                  <caption>Invoicing and collections by {trends.granularity}</caption>
                  <thead><tr><th scope="col">Period</th><th scope="col">Approved invoices</th><th scope="col">Payments received</th></tr></thead>
                  <tbody>{points.map((point) => <tr key={point.key || point.label}><th scope="row">{point.label}</th><td>{dashboardMoney(point.invoiced, currency)}</td><td>{dashboardMoney(point.collected, currency)}</td></tr>)}</tbody>
                </table>
              </Suspense>}
        </section>

        <section className={styles.panel} aria-labelledby="dashboard-activity-heading">
          <div className={styles.panelHeader}>
            <div><h2 id="dashboard-activity-heading">Recent activity</h2><p>Latest workspace changes · all dates</p></div>
            <span className={styles.panelIcon}><Activity size={19} aria-hidden="true" /></span>
          </div>
          {loading ? <div className={styles.skeletonList}>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} width="100%" height="48px" />)}</div> : errors.activity ?
            <Alert tone="warning" title="Activity unavailable">{errors.activity} <button type="button" className={styles.textButton} onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert> :
            activity.length ? <ul className={styles.activityList}>{activity.map((entry, index) => <li key={entry.id || index}>
              <span className={styles.activityDot} aria-hidden="true" />
              <div><strong>{entry.description || dashboardActionName(entry.action)}</strong><small>{entry.user_name || 'System'} · {dashboardDate(entry.created_at)}</small></div>
            </li>)}</ul> : <div className={styles.empty}><Activity size={26} aria-hidden="true" /><strong>No recent activity</strong><p>Your workspace events will be listed here.</p></div>}
          {canAccess('organization.manage') && hasEntitlement(entitlements, 'activity_log') && <p className={styles.panelFooter}><Link to="/app/activity-log">View activity log <ArrowUpRight size={14} aria-hidden="true" /></Link></p>}
        </section>
      </div>

      {summary && !loading && <div className={styles.bottomGrid}>
        <section className={styles.panel} aria-labelledby="dashboard-invoices-heading">
          <div className={styles.panelHeader}><div><h2 id="dashboard-invoices-heading"><ReceiptText size={18} aria-hidden="true" /> Recent invoices</h2><p>Latest in the selected period</p></div>{canAccess('invoices.view') && <Link to="/app/invoices">View all <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {recentInvoices.length ? <ul className={styles.documentList}>{recentInvoices.map((invoice) => <li key={invoice.id}>
            <span className={styles.documentIcon}><ReceiptText size={17} aria-hidden="true" /></span>
            <div className={styles.documentText}>{canAccess('invoices.view') ? <Link to={`/app/invoices/${invoice.id}`} className="ref">{invoice.invoice_number}</Link> : <strong className="ref">{invoice.invoice_number}</strong>}<small>{invoice.customer_name_snapshot || 'Customer'} · {dashboardDate(invoice.invoice_date)}</small></div>
            <div className={styles.documentAmount}><strong className="num">{dashboardMoney(invoice.total_amount, invoice.currency || currency)}</strong><StatusBadge status={invoice.status} /></div>
          </li>)}</ul> : <p className={styles.smallEmpty}>No invoices in this period.</p>}
        </section>
        <section className={styles.panel} aria-labelledby="dashboard-payments-heading">
          <div className={styles.panelHeader}><div><h2 id="dashboard-payments-heading"><WalletCards size={18} aria-hidden="true" /> Recent payments</h2><p>Latest receipts in the selected period</p></div>{canAccess('payments.view') && <Link to="/app/payments">View all <ArrowUpRight size={14} aria-hidden="true" /></Link>}</div>
          {recentPayments.length ? <ul className={styles.documentList}>{recentPayments.map((payment) => <li key={payment.id}>
            <span className={styles.documentIcon}><CreditCard size={17} aria-hidden="true" /></span>
            <div className={styles.documentText}>{canAccess('payments.view') ? <Link to={`/app/payments/${payment.id}`} className="ref">{payment.receipt_number}</Link> : <strong className="ref">{payment.receipt_number}</strong>}<small>{payment.customer_name_snapshot || 'Customer'} · {dashboardDate(payment.payment_date)}</small></div>
            <div className={styles.documentAmount}><strong className="num">{dashboardMoney(payment.amount, payment.currency || currency)}</strong><StatusBadge status={payment.status} /></div>
          </li>)}</ul> : <p className={styles.smallEmpty}>No payments in this period.</p>}
        </section>
      </div>}

      <Alert tone="info" icon={ShieldAlert} title="NRS integration status" className={styles.compliance}>
        {summary?.compliance_note || 'NRS/MBS integration is not connected. Dashboard figures reflect internal DigitalInvoice records only; they are not NRS submissions or clearance.'}
      </Alert>
      <nav className={styles.bottomActions} aria-label="Dashboard shortcuts">
        {canAccess('reports.view') && <Button size="sm" to="/app/reports" variant="secondary" icon={Activity}>View reports</Button>}
        {canAccess('invoices.view') && <Button size="sm" to="/app/invoices" variant="ghost" icon={ReceiptText}>Invoices</Button>}
        {canAccess('payments.view') && <Button size="sm" to="/app/payments" variant="ghost" icon={CreditCard}>Payments</Button>}
        {canAccess('catalogue.view') && <Button size="sm" to="/app/catalogue" variant="ghost" icon={Boxes}>Catalogue</Button>}
        {canAccess('customers.view') && <Button size="sm" to="/app/customers" variant="ghost" icon={UsersRound}>Customers</Button>}
      </nav>
    </main>
  )
}
