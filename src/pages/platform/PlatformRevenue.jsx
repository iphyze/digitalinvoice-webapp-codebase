import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CreditCard, RefreshCw, WalletCards, AlertTriangle, CalendarDays, CheckCircle2, CircleAlert, Clock3, UsersRound } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import { getErrorMessage } from '../../utils/httpError'
import { count, date, list, money, permission } from './platformModel'
import { pageMeta } from './billingModel'
import {
  REVENUE_STATUSES, normalizeRevenue, queryStringPayload, readRevenueParams, validateRevenueDraft,
} from './platformInsightsModel'
import styles from './PlatformAdmin.module.css'
import insights from './PlatformInsights.module.css'

const blank = { search: '', status: '', plan_id: '', date_from: '', date_to: '' }
const asDraft = (query) => Object.fromEntries(Object.keys(blank).map((key) => [key, query[key] || '']))

const metricIcons = {
  'paid_transactions': WalletCards,
  'monthly_paid_transactions': CalendarDays,
  'open_payment_issues': AlertTriangle,
  'recurring_clients': UsersRound,
  'filtered_paid_transactions': CheckCircle2,
  'filtered_pending_transactions': Clock3,
  'filtered_failed_transactions': CircleAlert,
}

export default function PlatformRevenue() {
  const [params, setParams] = useSearchParams()
  const queryKey = params.toString()
  const query = readRevenueParams(params)
  const [draft, setDraft] = useState(() => asDraft(query))
  const [draftError, setDraftError] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const actor = useAuthStore((state) => state.user)
  const access = useAuthStore((state) => state.platformAccess)
  const canViewClients = permission(access, actor, 'platform.clients.view')
  const canViewSubscriptions = permission(access, actor, 'platform.subscriptions.view')
  const invalidQuery = validateRevenueDraft(query)

  useEffect(() => {
    setDraft(asDraft(readRevenueParams(new URLSearchParams(queryKey))))
    setDraftError('')
  }, [queryKey])

  useEffect(() => {
    if (invalidQuery) {
      setResult(null)
      setLoading(false)
      setError('')
      return undefined
    }
    let alive = true
    setLoading(true)
    setError('')
    platformService.revenue(readRevenueParams(new URLSearchParams(queryKey)))
      .then((response) => { if (alive) setResult(normalizeRevenue(response)) })
      .catch((requestError) => {
        if (alive) {
          setResult(null)
          setError(getErrorMessage(requestError, 'Unable to load subscription revenue.'))
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [queryKey, revision, invalidQuery])

  const onApply = (event) => {
    event.preventDefault()
    const issue = validateRevenueDraft(draft)
    setDraftError(issue)
    if (!issue) {
      setParams(queryStringPayload(draft, { page: 1, limit: query.limit }))
      if (queryKey === new URLSearchParams(queryStringPayload(draft, { page: 1, limit: query.limit })).toString()) {
        setRevision((old) => old + 1)
      }
    }
  }
  const clear = () => { setDraft(blank); setDraftError(''); setParams({}) }
  const goPage = (page) => setParams(queryStringPayload(query, { page, limit: query.limit }))
  const changeLimit = (limit) => setParams(queryStringPayload(query, { page: 1, limit }))

  const summary = result?.summary || {}
  const currencyRows = list(result?.currency_breakdown)
  const filteredCurrencyRows = list(result?.filtered_currency_breakdown)
  const overall = [
    ['Paid transactions · lifetime', 'paid_transactions'],
    ['Paid transactions · this month', 'monthly_paid_transactions'],
    ['Open payment issues', 'open_payment_issues'],
    ['Recurring clients', 'recurring_clients'],
  ]
  const filtered = [
    ['Paid · matching filters', 'filtered_paid_transactions'],
    ['Pending · matching filters', 'filtered_pending_transactions'],
    ['Failed · matching filters', 'filtered_failed_transactions'],
  ]
  const cols = [
    { key: 'organization', header: 'Client', cell: (payment) => <div className={insights.details}>
      <strong>{canViewClients ? <Link className={styles.link} to={`/platform/clients/${payment.organization_id}`}>{payment.organization_name || 'Client organisation'}</Link> : payment.organization_name || 'Client organisation'}</strong>
      <small>{payment.owner_email || payment.organization_email || '—'}</small>
    </div> },
    { key: 'plan', header: 'Plan', cell: (payment) => <div className={insights.details}><strong>{payment.plan_name || '—'}</strong><small>{payment.billing_interval || '—'}</small></div> },
    { key: 'reference', header: 'Payment reference', cell: (payment) => <span className="ref">{payment.payment_reference || '—'}</span> },
    { key: 'amount', header: 'Recorded amount', cell: (payment) => <strong className="num">{money(payment.amount, payment.currency || 'NGN')}</strong> },
    { key: 'status', header: 'Status', cell: (payment) => <StatusBadge status={payment.status} /> },
    { key: 'date', header: 'Payment date', cell: (payment) => <span className="num">{date(payment.paid_at || payment.created_at)}</span> },
    { key: 'provider', header: 'Provider', cell: (payment) => payment.provider || '—' },
  ]
  const monthly = list(result?.monthly_collections)
  const maxMonthlyCount = Math.max(1, ...monthly.map((item) => Number(item.paid_transactions) || 0))
  const planRows = list(result?.plan_breakdown)
  const maxPlanCount = Math.max(1, ...planRows.map((item) => Number(item.paid_transactions) || 0))
  const pg = pageMeta(result)

  return <main className={styles.page}>
    <PageHeader eyebrow="Platform billing" title="Revenue" description="Explore subscription payment records and billing activity across client workspaces." actions={<Button icon={RefreshCw} variant="secondary" onClick={() => setRevision((old) => old + 1)} disabled={loading}>Refresh</Button>} />
    <Alert tone="info" title="Revenue amounts and currencies">
      Each currency is reported separately. No exchange-rate conversion or cross-currency total is assumed. The register below retains every payment's original currency.
    </Alert>
    {(error || invalidQuery) && <Alert tone="danger" title="Revenue unavailable">{invalidQuery || error} <Button variant="secondary" size="sm" onClick={() => { if (invalidQuery) clear(); else setRevision((old) => old + 1) }}>Try again</Button></Alert>}
    <p className={insights.note}>The first four metrics are platform-wide, regardless of the table filters. Monetary values in the payment register retain their original recorded currency.</p>
    <section className={styles.stats} aria-label="Platform-wide payment metrics">
      {overall.map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={loading || !result || error ? '—' : count(summary[key])} />)}
    </section>
    {result && !error && <section className={styles.panel} aria-labelledby="currency-revenue-heading">
      <div className={styles.panelHeading}><div><h2 id="currency-revenue-heading"><WalletCards size={17} aria-hidden="true" /> Revenue by currency</h2><p>Platform-wide · independent of table filters</p></div></div>
      <DataTable columns={[
        { key: 'currency', header: 'Currency', cell: (row) => <strong className="ref">{row.currency}</strong> },
        { key: 'month', header: 'This month', cell: (row) => <strong className="num">{money(row.month_revenue, row.currency)}</strong> },
        { key: 'lifetime', header: 'Lifetime paid', cell: (row) => <span className="num">{money(row.lifetime_revenue, row.currency)}</span> },
        { key: 'mrr', header: 'MRR', cell: (row) => <span className="num">{money(row.mrr, row.currency)}</span> },
        { key: 'clients', header: 'Recurring clients', cell: (row) => <span className="num">{count(row.recurring_clients)}</span> },
      ]} rows={currencyRows} rowKey="currency" empty={<div className={styles.empty}><WalletCards size={24} /><strong>No recorded revenue</strong></div>} />
    </section>}
    {result && !error && <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="monthly-transactions-heading">
        <div className={styles.panelHeading}><div><h2 id="monthly-transactions-heading"><CalendarDays size={17} aria-hidden="true" /> Monthly paid transactions</h2><p>Last six calendar months · platform-wide</p></div></div>
        {monthly.length ? <div className={insights.breakdown}>
          {monthly.map((month) => <div className={insights.breakdownRow} key={month.month_key}>
            <div className={insights.breakdownMeta}><span>{month.month_label || month.month_key}</span><strong className="num">{count(month.paid_transactions)} paid</strong></div>
            <div className={insights.barTrack} aria-hidden="true"><span className={insights.barFill} style={{ width: `${Math.min(100, (Math.max(0, Number(month.paid_transactions) || 0) / maxMonthlyCount) * 100)}%` }} /></div>
          </div>)}
        </div> : <div className={styles.empty}><WalletCards size={24} /><strong>No monthly collections yet</strong></div>}
      </section>
      <section className={styles.panel} aria-labelledby="plan-transactions-heading">
        <div className={styles.panelHeading}><div><h2 id="plan-transactions-heading"><CreditCard size={17} aria-hidden="true" /> Paid transactions by plan</h2><p>Top eight plans · platform-wide</p></div>{canViewSubscriptions && <Link className={styles.link} to="/platform/subscriptions">Subscriptions</Link>}</div>
        {planRows.length ? <div className={insights.breakdown}>
          {planRows.map((plan) => <div className={insights.breakdownRow} key={plan.id}>
            <div className={insights.breakdownMeta}><span>{plan.name || 'Plan'} · {count(plan.active_subscribers)} active</span><strong className="num">{count(plan.paid_transactions)} paid</strong></div>
            <div className={insights.barTrack} aria-hidden="true"><span className={insights.barFill} style={{ width: `${Math.min(100, (Math.max(0, Number(plan.paid_transactions) || 0) / maxPlanCount) * 100)}%` }} /></div>
          </div>)}
        </div> : <div className={styles.empty}><CreditCard size={24} /><strong>No plan activity yet</strong></div>}
      </section>
    </div>}
    <section className={styles.panel} aria-labelledby="revenue-register-heading">
      <div className={styles.panelHeading}><div><h2 id="revenue-register-heading"><CreditCard size={17} aria-hidden="true" /> Subscription payments</h2><p>Search and filter the full server-paginated payment register.</p></div></div>
      <form className={styles.filters} onSubmit={onApply}>
        <TextField className={styles.search} label="Search payments" value={draft.search} maxLength={140} placeholder="Client, plan, email or reference" onChange={(event) => setDraft((old) => ({ ...old, search: event.target.value }))} />
        <Select label="Payment status" options={REVENUE_STATUSES} value={draft.status} onChange={(status) => setDraft((old) => ({ ...old, status }))} />
        <Select label="Plan" value={draft.plan_id} options={[{ value: '', label: 'All plans' }, ...list(result?.plans).map((plan) => ({ value: String(plan.id), label: plan.name }))]} onChange={(plan_id) => setDraft((old) => ({ ...old, plan_id }))} />
        <DatePicker label="From date" value={draft.date_from} isClearable onChange={(date_from) => setDraft((old) => ({ ...old, date_from }))} />
        <DatePicker label="To date" value={draft.date_to} isClearable onChange={(date_to) => setDraft((old) => ({ ...old, date_to }))} />
        <Button type="submit" disabled={loading}>Apply</Button><Button variant="secondary" onClick={clear}>Clear</Button>
      </form>
      {draftError && <Alert tone="danger" title="Check filters">{draftError}</Alert>}
      {result && !error && <div className={insights.currencyGroup} aria-labelledby="filtered-revenue-currency-heading">
        <div className={styles.panelHeading}><div><h2 id="filtered-revenue-currency-heading"><WalletCards size={17} aria-hidden="true" /> Paid amounts matching filters</h2><p>Server totals for all matching payments, not just this page</p></div></div>
        <DataTable columns={[
          { key: 'currency', header: 'Currency', cell: (row) => <strong className="ref">{row.currency}</strong> },
          { key: 'amount', header: 'Paid amount', cell: (row) => <strong className="num">{money(row.paid_amount, row.currency)}</strong> },
          { key: 'count', header: 'Paid transactions', cell: (row) => <span className="num">{count(row.paid_transactions)}</span> },
        ]} rows={filteredCurrencyRows} rowKey="currency" empty={<div className={styles.empty}><WalletCards size={24} /><strong>No matching payments</strong></div>} />
      </div>}
      {result && !error && <div className={styles.stats} aria-label="Filtered transaction counts">
        {filtered.map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={count(summary[key])} />)}
      </div>}
      {!error && !invalidQuery && <><DataTable columns={cols} rows={list(result?.payments)} loading={loading} empty={<div className={styles.empty}><WalletCards size={25} /><strong>No matching subscription payments</strong><p>Adjust the filters to see other payment records.</p></div>} />
        {result && <Pagination noun="payments" page={pg.page} limit={pg.limit} total={pg.total} totalPages={pg.totalPages} disabled={loading} onPageChange={goPage} onLimitChange={changeLimit} />}
      </>}
      <p className={insights.note}>Pagination and filtered counts come from the server. This table shows one page at a time; it is not a full transaction export. Last loaded: {date(result?.generated_at)}.</p>
    </section>
    <p className={insights.note}>This screen reports DigitalInvoice subscription billing, not customers' invoice turnover or official NRS transaction clearance.</p>
  </main>
}
