import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Crown, RefreshCw, Handshake, Inbox, PhoneCall, Sparkles } from 'lucide-react'
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
import Modal from '../../components/overlays/Modal'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { count, date, list, permission, unwrap } from './platformModel'
import { billingPageParams, pageMeta, premiumPayload, PREMIUM_STATUS_OPTIONS } from './billingModel'
import styles from './PlatformAdmin.module.css'
import billing from './PlatformBilling.module.css'

const metricIcons = {
  'total_requests': Crown,
  'new_requests': Sparkles,
  'contacted_requests': PhoneCall,
  'negotiating_requests': Handshake,
  'open_requests': Inbox,
}

export default function PlatformPremiumRequests() {
  const [params, setParams] = useSearchParams()
  const query = billingPageParams(params, ['search', 'status'])
  const [draft, setDraft] = useState({ search: query.search || '', status: query.status || '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('new')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const access = useAuthStore((s) => s.platformAccess)
  const actor = useAuthStore((s) => s.user)
  const canManage = permission(access, actor, 'platform.premium_requests.manage')
  const canOpenClients = permission(access, actor, 'platform.clients.view')
  const toast = useToastStore((s) => s.showToast)
  const updateParams = (data) => setParams(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== undefined && value !== null)))
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(unwrap(await platformService.premiumRequests(billingPageParams(params, ['search', 'status'])), ['requests', 'summary', 'pagination', 'status_options'])) }
    catch (err) { setData(null); setError(getErrorMessage(err, 'Unable to retrieve Premium requests.')) }
    finally { setLoading(false) }
  }, [params, revision])
  useEffect(() => { load() }, [load])
  const open = (item) => { setSelected(item); setStatus(item.status); setNote(item.admin_note || ''); setActionError('') }
  const save = async (event) => {
    event.preventDefault()
    if (!canManage || !selected || busy) return
    let payload
    try { payload = premiumPayload(selected, status, note) }
    catch (err) { setActionError(err.message); return }
    setBusy(true); setActionError('')
    try {
      await platformService.updatePremiumRequest(payload)
      toast('Premium request updated successfully.', 'success')
      setSelected(null); setRevision((n) => n + 1)
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to update Premium request.')) }
    finally { setBusy(false) }
  }
  const pg = pageMeta(data)
  const rows = list(data?.requests)
  const columns = [
    { key: 'business', header: 'Organisation / contact', cell: (item) => <div className={styles.rowTitle}><strong>{item.business_name || item.organization_name || 'Unknown business'}</strong><span>{item.contact_name || '—'} · {item.contact_email || '—'}</span></div> },
    { key: 'volume', header: 'Estimated usage', cell: (item) => <div className={styles.rowTitle}><span>Invoices: {item.expected_invoice_volume || 'Not specified'}</span><span>Team: {item.expected_team_size || 'Not specified'}</span></div> },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.status} /> },
    { key: 'assigned', header: 'Assigned to', cell: (item) => item.assigned_to_name || 'Unassigned' },
    { key: 'created', header: 'Requested', cell: (item) => <span className="num">{date(item.created_at)}</span> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform billing" title="Premium requests" description="Review bespoke plan enquiries, contact preferences and follow-up status." actions={<Button variant="secondary" icon={RefreshCw} disabled={loading} onClick={() => setRevision((n) => n + 1)}>Refresh</Button>} />
    {error && <Alert tone="danger" title="Premium requests unavailable">{error} <Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>Try again</Button></Alert>}
    <div className={styles.stats}>{[['Total enquiries', 'total_requests'], ['New', 'new_requests'], ['Contacted', 'contacted_requests'], ['Negotiating', 'negotiating_requests'], ['Open enquiries', 'open_requests']].map(([name, key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[name]} label={name} value={loading || error ? '—' : count(data?.summary?.[key])} />)}</div>
    <section className={styles.panel}>
      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); updateParams({ ...draft, page: 1, limit: query.limit }) }}>
        <TextField className={styles.search} label="Search requests" placeholder="Company, contact name or email" value={draft.search} onChange={(event) => setDraft((old) => ({ ...old, search: event.target.value }))} />
        <Select label="Status" options={PREMIUM_STATUS_OPTIONS} value={draft.status} onChange={(value) => setDraft((old) => ({ ...old, status: value }))} />
        <Button disabled={loading} type="submit">Apply</Button><Button variant="secondary" onClick={() => { setDraft({ search: '', status: '' }); setParams({}) }}>Clear</Button>
      </form>
      {!error && <><DataTable columns={columns} rows={rows} loading={loading} actions={(item) => <Button variant="secondary" size="sm" onClick={() => open(item)}>{canManage ? 'Review / manage' : 'Review'}</Button>} empty={<div className={styles.empty}><Crown size={25} /><strong>No Premium requests found</strong><p>Try other filters or check back later.</p></div>} />
        {data && <Pagination page={pg.page} total={pg.total} totalPages={pg.totalPages} limit={pg.limit} disabled={loading} noun="Premium requests" onPageChange={(page) => updateParams({ ...query, page })} onLimitChange={(limit) => updateParams({ ...query, page: 1, limit })} />}
      </>}
      <p className={styles.note}>Premium Requests are commercial enquiries. A status of “converted” does not automatically activate a subscription or confirm payment.</p>
    </section>
    <Modal open={Boolean(selected)} title="Premium request" description={selected?.business_name || selected?.organization_name || ''} size="lg" busy={busy} onClose={() => !busy && setSelected(null)} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Close</Button>{canManage && <Button type="submit" form="premium-review-form" loading={busy}>Save changes</Button>}</div>}>
      {selected && <form className={styles.form} id="premium-review-form" onSubmit={save}>
        <dl className={styles.details}>
          {[
            ['Business', selected.business_name || selected.organization_name], ['Contact', selected.contact_name],
            ['Email', selected.contact_email], ['Phone', selected.contact_phone], ['Expected invoice volume', selected.expected_invoice_volume],
            ['Expected team size', selected.expected_team_size], ['Requested by', selected.requested_by_name || selected.requested_by_email],
            ['Assigned to', selected.assigned_to_name || 'Unassigned'], ['Created', date(selected.created_at)],
            ['Last updated', date(selected.updated_at)],
          ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || '—'}</dd></div>)}
        </dl>
        {selected.organization_id && canOpenClients && <Link className={styles.link} to={`/platform/clients/${selected.organization_id}`} onClick={() => setSelected(null)}>Open client workspace details</Link>}
        {list(selected.required_features).length > 0 && <div><h3 className={billing.sectionTitle}>Requested features</h3><ul className={billing.featureList}>{selected.required_features.map((feature, index) => <li key={`${index}-${String(feature)}`}>{typeof feature === 'string' ? feature : (feature.label || feature.name || 'Feature')}</li>)}</ul></div>}
        {selected.message && <div className={billing.message}><h3 className={billing.sectionTitle}>Customer message</h3><p>{selected.message}</p></div>}
        {canManage ? <><Select label="Follow-up status" options={PREMIUM_STATUS_OPTIONS.filter((option) => option.value)} value={status} onChange={setStatus} /><Textarea label="Internal note" rows={4} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} hint="Internal only. Notes are not sent to the customer." /><p className={styles.note}>Assigned user remains unchanged. Assignment management requires a platform user selector and the corresponding permission.</p></> : <><StatusBadge status={selected.status} />{selected.admin_note && <div className={billing.message}><h3 className={billing.sectionTitle}>Internal note</h3><p>{selected.admin_note}</p></div>}</>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>}
    </Modal>
  </main>
}
