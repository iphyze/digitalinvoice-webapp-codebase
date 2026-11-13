import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, FileText, ShieldCheck, UsersRound, WalletCards } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Pagination from '../../components/data/Pagination'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import activityService from '../../services/activityService'
import { getErrorMessage } from '../../utils/httpError'
import { GROUP_OPTIONS, activityTimestamp, humanAction, normalizeActivity, readLimit, readPage, validateActivityFilters } from './activityModel'
import styles from './AdminRegister.module.css'

const EMPTY = { activities: [], summary: {}, pagination: { page: 1, limit: 10, total: 0, total_pages: 1 } }

const metricIcons = {
  'total_events': Activity,
  'invoice_events': FileText,
  'payment_events': WalletCards,
  'auth_events': ShieldCheck,
  'team_events': UsersRound,
}

export default function ActivityLog() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const group = GROUP_OPTIONS.some((opt) => opt.value === params.get('group')) ? params.get('group') : 'all'
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const page = readPage(params.get('page'))
  const limit = readLimit(params.get('limit'))
  const [results, setResults] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const filtersError = validateActivityFilters({ search, from, to })

  const change = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10) || (key === 'group' && value === 'all')) next.delete(key)
      else next.set(key, String(value))
    })
    return next
  }), [setParams])

  useEffect(() => {
    if (filtersError) { setLoading(false); return undefined }
    let live = true
    setLoading(true); setError('')
    activityService.list({ page, limit, ...(search ? { search } : {}), ...(group !== 'all' ? { group } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })
      .then((response) => { if (live) setResults(normalizeActivity(response)) })
      .catch((err) => { if (live) { setError(getErrorMessage(err, 'Unable to load activity log.')); setResults(EMPTY) } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [page, limit, search, group, from, to, revision, filtersError])

  const columns = [
    { key: 'when', header: 'Date & time', cell: (entry) => <span className="num">{activityTimestamp(entry.created_at)}</span> },
    { key: 'action', header: 'Action', cell: (entry) => <div className={styles.rowTitle}><strong title={humanAction(entry.action)}>{humanAction(entry.action)}</strong><span className="ref" title={entry.action}>{entry.action}</span></div> },
    { key: 'description', header: 'Description', cell: (entry) => <span className={styles.auditDescription}>{entry.description || '—'}</span> },
    { key: 'by', header: 'Performed by', cell: (entry) => <div className={styles.rowTitle}><strong title={entry.user_name || 'System'}>{entry.user_name || 'System'}</strong><span title={entry.user_email || '—'}>{entry.user_email || '—'}</span></div> },
    { key: 'address', header: 'IP address', cell: (entry) => <span className="num">{entry.ip_address || '—'}</span> },
  ]
  const summary = results.summary
  return <main className={styles.page}>
    <PageHeader eyebrow="Workspace administration" title="Activity log" description="Review who performed important operations in your workspace." actions={<Button icon={RefreshCw} variant="secondary" onClick={() => setRevision((n) => n + 1)} disabled={loading}>Refresh</Button>} />
    <p className={styles.sectionNote}>Summary counters reflect the last 30 days across the organisation; table rows reflect your selected filters and are paginated by the server.</p>
    <div className={styles.stats}>{[
      ['Events · last 30 days', 'total_events'], ['Invoice events', 'invoice_events'], ['Payment events', 'payment_events'], ['Authentication events', 'auth_events'], ['Team events', 'team_events'],
    ].map(([label, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[label]} label={label} value={loading || error ? '—' : Number(summary[key] || 0).toLocaleString()} />)}</div>
    <section className={styles.panel}>
      <div className={styles.filters}>
        <TextField className={styles.search} label="Search events" value={search} maxLength={120} onChange={(e) => change({ search: e.target.value, page: 1 })} placeholder="Action, description, name or email" />
        <Select label="Category" value={group} options={GROUP_OPTIONS} onChange={(value) => change({ group: value, page: 1 })} />
        <DatePicker label="From date" value={from} onChange={(value) => change({ from: value, page: 1 })} isClearable />
        <DatePicker label="To date" value={to} onChange={(value) => change({ to: value, page: 1 })} isClearable />
        <Button variant="secondary" onClick={() => change({ search: '', group: 'all', from: '', to: '', page: 1 })}>Clear filters</Button>
      </div>
      {filtersError && <Alert tone="danger" title="Check filters">{filtersError}</Alert>}
      {error && <Alert tone="danger" title="Unable to load activity">{error} <Button size="sm" variant="secondary" onClick={() => setRevision((n) => n + 1)}>Try again</Button></Alert>}
      {!error && !filtersError && <><DataTable columns={columns} rows={results.activities} loading={loading} empty={<div className={styles.empty}><Activity size={25} aria-hidden="true" /><h3>No matching activity</h3><p>Adjust the filters or date range to see more events.</p></div>} />
        {!loading && <Pagination page={Number(results.pagination.page) || page} limit={limit} total={Number(results.pagination.total) || 0} totalPages={Number(results.pagination.total_pages) || 1} noun="events" onPageChange={(n) => change({ page: n })} onLimitChange={(n) => change({ limit: n, page: 1 })} />}
      </>}
    </section>
  </main>
}
