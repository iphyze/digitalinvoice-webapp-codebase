import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Link2, LockKeyhole, RefreshCw, ShieldCheck, ShieldX, TimerOff, XCircle } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import portalLinkService from '../../services/portalLinkService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission } from '../../utils/entitlements'
import {
  PORTAL_LINKS_MAX_RECENT,
  PORTAL_LINK_STATUSES,
  PORTAL_LINK_TYPES,
  portalLinkCollection,
  portalLinkDocumentLabel,
  portalLinkDocumentPath,
  portalLinkFilter,
  portalLinkMetrics,
  portalLinkStatus,
  portalLinkStatusTone,
} from './portalLinkModel'
import registerStyles from '../invoices/Invoices.module.css'
import styles from './CustomerPortalLinks.module.css'

const validStatus = (value) => PORTAL_LINK_STATUSES.some((entry) => entry.value === value) ? value : 'all'
const validType = (value) => PORTAL_LINK_TYPES.some((entry) => entry.value === value) ? value : ''
const readPage = (value) => Math.max(1, Math.floor(Number(value) || 1))
const readLimit = (value) => [10, 20, 50].includes(Number(value)) ? Number(value) : 10

export default function CustomerPortalLinks() {
  const permissions = useAuthStore((state) => state.permissions)
  const entitlements = useAuthStore((state) => state.entitlements)
  const toast = useToastStore((state) => state.showToast)
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const status = validStatus(params.get('status'))
  const documentType = validType(params.get('type'))
  const page = readPage(params.get('page'))
  const limit = readLimit(params.get('limit'))
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  const updateParams = useCallback((updates) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value == null || (key === 'status' && value === 'all') ||
        (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    }
    return next
  }), [setParams])
  const onSearch = useCallback((value) => updateParams({ search: value, page: 1 }), [updateParams])
  const reset = useCallback(() => updateParams({ search: '', status: 'all', type: '', page: 1 }), [updateParams])
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setRefreshing(true)
    setError('')
    portalLinkService.list()
      .then((response) => {
        if (!active) return
        setLinks(portalLinkCollection(response))
      })
      .catch((requestError) => {
        if (!active) return
        setError(getErrorMessage(requestError, 'Unable to load customer portal links.'))
        setLinks([])
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => { active = false }
  }, [revision])

  const metrics = useMemo(() => portalLinkMetrics(links), [links])
  const filtered = useMemo(
    () => portalLinkFilter(links, { search, status, documentType }),
    [links, search, status, documentType],
  )
  const pages = Math.max(1, Math.ceil(filtered.length / limit))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * limit, currentPage * limit)
  const hasFilters = Boolean(search || documentType || status !== 'all')
  const availableRegisters = PORTAL_LINK_TYPES
    .filter((item) => item.path && hasPermission(permissions, item.permission) &&
      hasEntitledPermission(entitlements, item.permission))
    .map((item) => ({ label: item.label, path: `/app/${item.path}` }))

  const confirmRevoke = async () => {
    if (!revokeTarget || revoking) return
    const target = revokeTarget
    setRevoking(true)
    setRevokeError('')
    try {
      const response = await portalLinkService.revoke(target.id)
      const updated = response.data?.data?.link
      if (updated?.id) {
        setLinks((current) => current.map((link) => Number(link.id) === Number(target.id) ? updated : link))
      }
      setRevokeTarget(null)
      toast('Secure customer link revoked successfully.', 'success', 'Link revoked')
      refresh()
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Unable to revoke this secure link.')
      setRevokeError(message)
      setRevokeTarget(null)
      toast(message, 'error', 'Revoke failed')
    } finally {
      setRevoking(false)
    }
  }

  const badge = (link) => {
    const value = portalLinkStatus(link)
    return <StatusBadge status={value} tone={portalLinkStatusTone(value)} />
  }
  const documentCell = (link) => {
    const to = portalLinkDocumentPath(link, permissions, entitlements)
    return <div className={styles.documentCell}>
      {to ? <Link className="ref" to={to}>{link.title || `${portalLinkDocumentLabel(link.document_type)} #${link.document_id}`}</Link>
        : <strong className="ref">{link.title || `${portalLinkDocumentLabel(link.document_type)} #${link.document_id}`}</strong>}
      <small>{portalLinkDocumentLabel(link.document_type)} · Link #{link.id}</small>
    </div>
  }
  const actions = (link) => {
    const to = portalLinkDocumentPath(link, permissions, entitlements)
    const active = portalLinkStatus(link) === 'active'
    return <div className={registerStyles.rowActions}>
      {to && <Link className={`${registerStyles.iconAction} ${registerStyles.viewAction}`} to={to}
        title="Open source document" aria-label={`Open source document for ${link.title || `link ${link.id}`}`}>
        <ExternalLink size={16} aria-hidden="true" />
      </Link>}
      {active && <button type="button" className={`${registerStyles.iconAction} ${registerStyles.danger}`}
        title="Revoke link" aria-label={`Revoke ${link.title || `link ${link.id}`}`}
        disabled={revoking} onClick={() => { setRevokeError(''); setRevokeTarget(link) }}>
        <XCircle size={16} aria-hidden="true" />
      </button>}
    </div>
  }
  const columns = [
    { key: 'document', header: 'Document', width: '23%', cell: documentCell },
    { key: 'recipient', header: 'Recipient', width: '23%', cell: (link) => <div className={styles.recipientCell}>
      <strong>{link.recipient_name || 'Customer'}</strong><small>{link.recipient_email || 'No email saved'}</small></div> },
    { key: 'created', header: 'Created', width: '13%', cell: (link) => <div className={styles.metaCell}>
      <span className="num">{formatDate(link.created_at)}</span>
      {link.created_by_name && <small>By {link.created_by_name}</small>}</div> },
    { key: 'expires', header: 'Expires', width: '13%', cell: (link) => <span className="num">{formatDate(link.expires_at)}</span> },
    { key: 'views', header: 'Views', width: '13%', align: 'right', cell: (link) => <div className={styles.metaCell}>
      <strong className="num">{Math.max(0, Number(link.access_count) || 0).toLocaleString('en-NG')}</strong>
      {link.last_accessed_at && <small>Last: {formatDate(link.last_accessed_at)}</small>}</div> },
    { key: 'status', header: 'Status', width: '15%', cell: badge },
  ]
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => updateParams({ search: '', page: 1 }) }] : []),
    ...(documentType ? [{ key: 'type', label: portalLinkDocumentLabel(documentType), onRemove: () => updateParams({ type: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: PORTAL_LINK_STATUSES.find((option) => option.value === status)?.label || status,
      onRemove: () => updateParams({ status: 'all', page: 1 }) }] : []),
  ]
  const stats = [
    { label: 'Recent links', value: metrics.total, icon: Link2, tone: 'blue' },
    { label: 'Active in recent links', value: metrics.active, icon: ShieldCheck, tone: 'green' },
    { label: 'Expired in recent links', value: metrics.expired, icon: TimerOff, tone: 'amber' },
    { label: 'Revoked in recent links', value: metrics.revoked, icon: ShieldX, tone: 'violet' },
    { label: 'Views across recent links', value: metrics.views, icon: ExternalLink, tone: 'teal' },
  ]
  const empty = <div className={registerStyles.empty}>
    <LockKeyhole size={30} aria-hidden="true" />
    <h2>{hasFilters ? 'No matching secure links' : 'No secure links yet'}</h2>
    <p>{hasFilters ? 'Try adjusting the search, document type or status.'
      : 'Open an issued document and use Secure link to generate a private customer portal link.'}</p>
    {hasFilters && <Button variant="secondary" onClick={reset}>Clear filters</Button>}
    {!hasFilters && availableRegisters[0] && <Button to={availableRegisters[0].path}>Open {availableRegisters[0].label.toLowerCase()}</Button>}
  </div>

  return <div className={`${registerStyles.page} fx-enter`}>
    <PageHeader eyebrow="Customer portal" title="Secure links"
      description="Manage private customer-facing links generated from invoices, receipts, credit notes, proformas and delivery notes."
      actions={<Button variant="secondary" icon={RefreshCw} onClick={refresh} loading={refreshing}>
        Refresh links
      </Button>} />

    <Alert tone="info" title="Create links from the original document">
      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <p>Open an approved invoice or credit note, a valid payment receipt, or an issued proforma or delivery note, then select <strong>Secure link</strong>. The private URL is shown only when created and cannot be retrieved here later.</p>
          {availableRegisters.length > 0 && <div className={styles.introLinks}>
            {availableRegisters.map((item) => <Link key={item.path} to={item.path}>{item.label}</Link>)}
          </div>}
        </div>
      </div>
    </Alert>

    <div className={registerStyles.stats}>
      {stats.map(({ label, value, icon: Icon, tone }) => <div className={registerStyles.stat} data-tone={tone} key={label}>
        <span className={registerStyles.statIcon}><Icon size={19} aria-hidden="true" /></span>
        <div className={registerStyles.statBody}>
          <strong className="num">{loading || error ? '—' : Number(value).toLocaleString('en-NG')}</strong>
          <span>{label}</span>
        </div>
      </div>)}
    </div>
    <p className={styles.note}>Metrics, search and filters cover only the latest {PORTAL_LINKS_MAX_RECENT} links returned by the server, not the organisation's full history. Statuses are current as of the last refresh.</p>
    {revokeError && <Alert tone="danger" title="Could not revoke the link" onDismiss={() => setRevokeError('')}>{revokeError}</Alert>}

    <FilterBar search={search} onSearchChange={onSearch} busy={refreshing && !loading}
      placeholder="Search document, recipient or link ID..."
      filters={[
        { key: 'type', value: documentType, onChange: (value) => updateParams({ type: value, page: 1 }), options: PORTAL_LINK_TYPES },
        { key: 'status', value: status, onChange: (value) => updateParams({ status: value, page: 1 }), options: PORTAL_LINK_STATUSES },
      ]}
      chips={chips} onReset={reset} />

    {error ? <div className={registerStyles.empty} role="alert">
      <ShieldX size={30} aria-hidden="true" />
      <h2>Customer portal links unavailable</h2>
      <p>{error}</p>
      <Button onClick={refresh}>Try again</Button>
    </div> : <>
      <DataTable columns={columns} minWidth={970} rows={visible} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(link) => <div className={styles.mobileCard}>
          <div className={styles.mobileTop}>{documentCell(link)}{badge(link)}</div>
          <div className={styles.recipientCell}><strong>{link.recipient_name || 'Customer'}</strong>
            <small>{link.recipient_email || 'No email saved'}</small></div>
          <div className={styles.mobileMeta}>
            <div><span>Created</span><strong className="num">{formatDate(link.created_at)}</strong></div>
            <div><span>Expires</span><strong className="num">{formatDate(link.expires_at)}</strong></div>
            <div><span>Views</span><strong className="num">{Math.max(0, Number(link.access_count) || 0).toLocaleString('en-NG')}</strong></div>
            <div><span>Last viewed</span><strong className="num">{formatDate(link.last_accessed_at)}</strong></div>
          </div>
          <div className={styles.mobileFooter}><small>Link #{link.id}</small>{actions(link)}</div>
        </div>} />
      {!loading && filtered.length > 0 && <Pagination noun="recent links" page={currentPage}
        limit={limit} total={filtered.length} totalPages={pages} disabled={refreshing}
        onPageChange={(value) => updateParams({ page: value })}
        onLimitChange={(value) => updateParams({ limit: value, page: 1 })} />}
    </>}

    <ConfirmDialog open={Boolean(revokeTarget)} onClose={() => { setRevokeTarget(null); setRevokeError('') }}
      title="Revoke secure link?"
      message={`This immediately prevents anyone from using the link for “${revokeTarget?.title || 'this document'}”. It cannot be restored. You can create a new link from the source document.`}
      confirmLabel="Revoke link" variant="danger" loading={revoking} onConfirm={confirmRevoke} />
  </div>
}
