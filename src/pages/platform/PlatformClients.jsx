import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, RefreshCw, Archive, CirclePause, CreditCard, ShieldCheck } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import platformService from '../../services/platformService'
import { getErrorMessage } from '../../utils/httpError'
import { CLIENT_STATUSES, SUBSCRIPTION_STATUSES, assertClientPagination, assertCurrencyAmounts, count, date, list, unwrap } from './platformModel'
import PlatformCurrencyBreakdown from './PlatformCurrencyBreakdown'
import styles from './PlatformAdmin.module.css'

const metricIcons = {
  'total_clients': Building2,
  'active_clients': ShieldCheck,
  'subscription_required_clients': CreditCard,
  'suspended_clients': CirclePause,
  'archived_clients': Archive,
}

export default function PlatformClients() {
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState({ search: params.get('search') || '', status: params.get('status') || '', subscription_status: params.get('subscription_status') || '' })
  const search = params.get('search') || ''
  const status = params.get('status') || ''
  const subscriptionStatus = params.get('subscription_status') || ''
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  const requestedLimit = [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 10
  useEffect(() => { setDraft({ search, status, subscription_status: subscriptionStatus }) }, [search, status, subscriptionStatus])
  const changePaging = (page, limit = requestedLimit) => {
    const next = new URLSearchParams(params)
    next.set('page', String(page))
    next.set('limit', String(limit))
    setParams(next)
  }
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const apply = (event) => {
    event.preventDefault()
    setParams({ ...Object.fromEntries(Object.entries(draft).filter(([, value]) => String(value || '').trim())), page: '1', limit: String(requestedLimit) })
  }
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await platformService.clients({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(subscriptionStatus ? { subscription_status: subscriptionStatus } : {}),
        page: requestedPage, limit: requestedLimit,
      })
      const data = assertClientPagination(unwrap(response, ['summary', 'clients', 'pagination']), requestedPage, requestedLimit)
      assertCurrencyAmounts(data.summary?.lifetime_revenue_by_currency)
      list(data.clients).forEach((client) => assertCurrencyAmounts(client.lifetime_revenue_by_currency))
      setResult(data)
    }
    catch (err) { setResult(null); setError(getErrorMessage(err, 'Unable to load clients.')) }
    finally { setLoading(false) }
  }, [search, status, subscriptionStatus, requestedPage, requestedLimit, revision])
  useEffect(() => { load() }, [load])
  const rows = list(result?.clients)
  const summary = result?.summary || {}
  const columns = [
    { key: 'client', header: 'Client organisation', cell: (item) => <div className={styles.rowTitle}><Link className={styles.link} to={`/platform/clients/${item.id}`}>{item.name}</Link><span>{item.business_email || 'No business email'} · {item.owner_name || 'No owner'}</span></div> },
    { key: 'status', header: 'Account', cell: (item) => <StatusBadge status={item.status} /> },
    { key: 'plan', header: 'Plan', cell: (item) => <div className={styles.rowTitle}><strong>{item.plan_name || 'No plan'}</strong><span><StatusBadge status={item.subscription_status || 'none'} /></span></div> },
    { key: 'users', header: 'Users', cell: (item) => <span className="num">{count(item.user_count)}</span> },
    { key: 'joined', header: 'Created', cell: (item) => <span className="num">{date(item.created_at)}</span> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Clients" description="Find customer organisations, review account status and open workspace details." actions={<Button icon={RefreshCw} variant="secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</Button>} />
    {error && <Alert tone="danger" title="Client register unavailable">{error} <Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>Try again</Button></Alert>}
    <div className={styles.stats}>{[['Total clients', 'total_clients'], ['Active', 'active_clients'], ['Subscription required', 'subscription_required_clients'], ['Suspended', 'suspended_clients'], ['Archived', 'archived_clients']].map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={loading || error ? '—' : count(summary[key])} />)}</div>
    {result && !error && <PlatformCurrencyBreakdown title="Subscription payments by currency" rows={summary.lifetime_revenue_by_currency} note="Platform-wide paid subscription revenue; these amounts are not summed across currencies." />}
    <section className={styles.panel}>
      <form className={styles.filters} onSubmit={apply}>
        <TextField className={styles.search} label="Search clients" maxLength={120} value={draft.search} onChange={(event) => setDraft((old) => ({ ...old, search: event.target.value }))} placeholder="Company, owner or email" />
        <Select label="Account status" value={draft.status} options={CLIENT_STATUSES} onChange={(value) => setDraft((old) => ({ ...old, status: value }))} />
        <Select label="Subscription status" value={draft.subscription_status} options={SUBSCRIPTION_STATUSES} onChange={(value) => setDraft((old) => ({ ...old, subscription_status: value }))} />
        <Button type="submit" disabled={loading}>Apply</Button>
        <Button variant="secondary" onClick={() => { setDraft({ search: '', status: '', subscription_status: '' }); setParams({}) }}>Clear</Button>
      </form>
      {!error && <><DataTable columns={columns} rows={rows} loading={loading} empty={<div className={styles.empty}><Building2 size={27} /><strong>No matching clients</strong><p>Try different filters or wait for a new registration.</p></div>} />
        {!loading && result && <>
          <Pagination page={requestedPage} limit={requestedLimit} total={Number(result.pagination?.total) || 0} totalPages={Number(result.pagination?.total_pages) || 1} onPageChange={(next) => changePaging(next)} onLimitChange={(next) => changePaging(1, next)} disabled={loading} noun="clients" />
          <p className={styles.note}>Summary cards and currency amounts are platform-wide, not filter-specific.</p>
        </>}
      </>}
    </section>
  </main>
}
