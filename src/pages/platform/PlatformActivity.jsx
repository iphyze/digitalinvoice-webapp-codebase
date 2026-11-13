import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, RefreshCw, Building2, CalendarDays, CreditCard, ShieldCheck } from 'lucide-react'
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
import { count, date, list, permission } from './platformModel'
import { pageMeta } from './billingModel'
import {
  ACTIVITY_GROUPS, activeOptions, activityTimestamp, activityTitle, normalizePlatformActivity,
  queryStringPayload, readActivityParams, validateActivityDraft,
} from './platformInsightsModel'
import styles from './PlatformAdmin.module.css'
import insights from './PlatformInsights.module.css'

const blank = { search: '', group: 'all', actor_id: '', client_id: '', date_from: '', date_to: '' }
const asDraft = (query) => Object.fromEntries(Object.keys(blank).map((key) => [key, query[key] || blank[key]]))

const metricIcons = {
  'total_events': Activity,
  'recent_events': CalendarDays,
  'access_events': ShieldCheck,
  'subscription_events': CreditCard,
  'affected_clients': Building2,
}

export default function PlatformActivity() {
  const [params, setParams] = useSearchParams()
  const queryKey = params.toString()
  const query = readActivityParams(params)
  const [draft, setDraft] = useState(() => asDraft(query))
  const [draftError, setDraftError] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const actor = useAuthStore((state) => state.user)
  const access = useAuthStore((state) => state.platformAccess)
  const canViewClients = permission(access, actor, 'platform.clients.view')
  const invalidQuery = validateActivityDraft(query)

  useEffect(() => {
    setDraft(asDraft(readActivityParams(new URLSearchParams(queryKey))))
    setDraftError('')
  }, [queryKey])

  useEffect(() => {
    if (invalidQuery) {
      setResult(null)
      setError('')
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError('')
    platformService.activity(readActivityParams(new URLSearchParams(queryKey)))
      .then((response) => { if (alive) setResult(normalizePlatformActivity(response)) })
      .catch((requestError) => {
        if (alive) {
          setResult(null)
          setError(getErrorMessage(requestError, 'Unable to load platform activity.'))
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [queryKey, revision, invalidQuery])

  const onApply = (event) => {
    event.preventDefault()
    const issue = validateActivityDraft(draft)
    setDraftError(issue)
    if (!issue) {
      const next = queryStringPayload(draft, { page: 1, limit: query.limit })
      setParams(next)
      if (queryKey === new URLSearchParams(next).toString()) setRevision((old) => old + 1)
    }
  }
  const clear = () => { setDraft(blank); setDraftError(''); setParams({}) }
  const goPage = (page) => setParams(queryStringPayload(query, { page, limit: query.limit }))
  const changeLimit = (limit) => setParams(queryStringPayload(query, { page: 1, limit }))
  const summary = result?.summary || {}
  const counts = [
    ['All platform events', 'total_events'],
    ['Events · last 30 days', 'recent_events'],
    ['Access events', 'access_events'],
    ['Subscription events', 'subscription_events'],
    ['Affected clients', 'affected_clients'],
  ]
  const actorOptions = activeOptions(result?.actors, draft.actor_id, 'All actors', (user) => `${user.name || user.email} · ${user.email}`)
  const clientOptions = activeOptions(result?.clients, draft.client_id, 'All clients', (client) => client.name || client.email || `Client ${client.id}`)
  const columns = [
    { key: 'timestamp', header: 'Date & time', cell: (event) => <span className="num">{activityTimestamp(event.created_at)}</span> },
    { key: 'action', header: 'Action', cell: (event) => <div className={insights.activityText}><strong>{activityTitle(event.action)}</strong><span className="ref">{event.action}</span></div> },
    { key: 'description', header: 'Description', cell: (event) => <span>{event.description || '—'}</span> },
    { key: 'actor', header: 'Performed by', cell: (event) => <div className={insights.details}><strong>{event.actor?.name || 'System'}</strong><small>{event.actor?.email || '—'}</small></div> },
    { key: 'client', header: 'Client / scope', cell: (event) => <div className={insights.details}><strong>{event.client?.name && canViewClients && event.organization_id ? <Link className={styles.link} to={`/platform/clients/${event.organization_id}`}>{event.client.name}</Link> : event.client?.name || 'Platform'}</strong><small>{event.client?.email || '—'}</small></div> },
    { key: 'ip', header: 'IP address', cell: (event) => <span className="num">{event.ip_address || '—'}</span> },
  ]
  const pg = pageMeta(result)

  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Activity logs" description="Review important platform operations, who performed them and the affected client." actions={<Button variant="secondary" icon={RefreshCw} onClick={() => setRevision((old) => old + 1)} disabled={loading}>Refresh</Button>} />
    <p className={insights.note}>Summary counts cover platform events across all clients. The table is separately filtered and paginated by the server; activity records should not be treated as an immutable certification audit trail.</p>
    {(error || invalidQuery) && <Alert tone="danger" title="Activity unavailable">{invalidQuery || error} <Button variant="secondary" size="sm" onClick={() => { if (invalidQuery) clear(); else setRevision((old) => old + 1) }}>Try again</Button></Alert>}
    <section className={styles.stats} aria-label="Platform-wide activity metrics">
      {counts.map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={loading || !result || error ? '—' : count(summary[key])} />)}
    </section>
    <section className={styles.panel} aria-labelledby="platform-activity-register-heading">
      <div className={styles.panelHeading}><div><h2 id="platform-activity-register-heading"><Activity size={17} aria-hidden="true" /> Audit events</h2><p>Search actions, descriptions, actors, client records and IP addresses.</p></div></div>
      <form className={styles.filters} onSubmit={onApply}>
        <TextField className={styles.search} label="Search events" value={draft.search} maxLength={140} placeholder="Action, description, person or IP" onChange={(event) => setDraft((old) => ({ ...old, search: event.target.value }))} />
        <Select label="Event category" value={draft.group} options={ACTIVITY_GROUPS} onChange={(group) => setDraft((old) => ({ ...old, group }))} />
        <Select label="Actor" value={draft.actor_id} options={actorOptions} isSearchable onChange={(actor_id) => setDraft((old) => ({ ...old, actor_id }))} />
        <Select label="Client" value={draft.client_id} options={clientOptions} isSearchable onChange={(client_id) => setDraft((old) => ({ ...old, client_id }))} />
        <DatePicker label="From date" isClearable value={draft.date_from} onChange={(date_from) => setDraft((old) => ({ ...old, date_from }))} />
        <DatePicker label="To date" isClearable value={draft.date_to} onChange={(date_to) => setDraft((old) => ({ ...old, date_to }))} />
        <Button type="submit" disabled={loading}>Apply</Button><Button variant="secondary" onClick={clear}>Clear</Button>
      </form>
      {draftError && <Alert tone="danger" title="Check filters">{draftError}</Alert>}
      {!error && !invalidQuery && <>
        <DataTable columns={columns} rows={list(result?.events)} loading={loading} empty={<div className={styles.empty}><Activity size={25} aria-hidden="true" /><strong>No matching events</strong><p>Try another category, date range or search.</p></div>} />
        {result && <Pagination noun="events" page={pg.page} limit={pg.limit} total={pg.total} totalPages={pg.totalPages} disabled={loading} onPageChange={goPage} onLimitChange={changeLimit} limits={[10, 15, 20, 50]} />}
      </>}
      <p className={insights.note}>Actor and client selectors list only the most recent available choices (up to 100 actors and 150 clients). Search can still match other events. Raw event metadata is deliberately not displayed.</p>
    </section>
    <p className={insights.note}>Last loaded: {date(result?.generated_at)}. Only authorised platform users can view this report.</p>
  </main>
}
