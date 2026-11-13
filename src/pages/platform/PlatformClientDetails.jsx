import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, RefreshCw, ShieldAlert, FileText, UsersRound, WalletCards, Activity, CreditCard } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import Alert from '../../components/ui/Alert'
import Modal from '../../components/overlays/Modal'
import Textarea from '../../components/forms/Textarea'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { assertCurrencyAmounts, clientAction, count, date, list, money, permission, unwrap } from './platformModel'
import PlatformCurrencyBreakdown from './PlatformCurrencyBreakdown'
import styles from './PlatformAdmin.module.css'

const ACTION_COPY = {
  activate: ['Activate workspace?', 'Restore this client account. Subscription requirements will still be enforced.', 'Activate'],
  suspend: ['Suspend workspace?', 'This will revoke the organisation’s users’ active sessions and block workspace access.', 'Suspend'],
  archive: ['Archive workspace?', 'Archiving cancels current subscriptions and revokes sessions. This action is not reversible through this screen.', 'Archive'],
}

export default function PlatformClientDetails() {
  const { id } = useParams()
  const access = useAuthStore((s) => s.platformAccess)
  const actor = useAuthStore((s) => s.user)
  const toast = useToastStore((s) => s.showToast)
  const canManage = permission(access, actor, 'platform.clients.manage')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = unwrap(await platformService.client(id), ['client', 'operational_summary', 'users', 'subscriptions', 'subscription_payments', 'activity'])
      assertCurrencyAmounts(response.client?.lifetime_revenue_by_currency)
      assertCurrencyAmounts(response.operational_summary?.approved_invoice_value_by_currency)
      assertCurrencyAmounts(response.operational_summary?.payment_value_by_currency)
      setData(response)
    }
    catch (err) { setData(null); setError(getErrorMessage(err, 'Unable to load client workspace.')) }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])
  const submit = async () => {
    if (!data || !action || !canManage) return
    let payload
    try { payload = clientAction(data.client, action, reason) }
    catch (err) { setActionError(err.message); return }
    setBusy(true); setActionError('')
    try {
      await platformService.updateClientAccount(payload)
      setAction(''); setReason('')
      toast('Client workspace status updated successfully.', 'success')
      await load()
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to change client workspace status.')) }
    finally { setBusy(false) }
  }
  const client = data?.client
  const summary = data?.operational_summary || {}
  const usersColumns = [
    { key: 'name', header: 'User', cell: (item) => <div className={styles.rowTitle}><strong>{item.name || 'Unnamed'}</strong><span>{item.email}</span></div> },
    { key: 'role', header: 'Workspace role', cell: (item) => item.role },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.is_active ? 'active' : 'inactive'} /> },
    { key: 'last_login', header: 'Last login', cell: (item) => <span className="num">{date(item.last_login)}</span> },
  ]
  const subColumns = [
    { key: 'plan', header: 'Plan', cell: (item) => <div className={styles.rowTitle}><strong>{item.plan_name}</strong><span>{item.billing_interval}</span></div> },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.status} /> },
    { key: 'amount', header: 'Plan amount', cell: (item) => <span className="num">{money(item.amount, item.currency)}</span> },
    { key: 'ends', header: 'Period ends', cell: (item) => <span className="num">{date(item.current_period_end)}</span> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration · Clients" title={client?.name || 'Client workspace'} description="Review organisation access, billing and recent activity." actions={<div className={styles.actions}><Button to="/platform/clients" variant="ghost" icon={ArrowLeft}>All clients</Button><Button icon={RefreshCw} variant="secondary" disabled={loading || busy} onClick={load}>Refresh</Button></div>} />
    {error && <Alert tone="danger" title="Client details unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Retry</Button></Alert>}
    {loading && !error && <div className={styles.panel} aria-busy="true"><p className={styles.note}>Loading client details…</p></div>}
    {client && !loading && <>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2><Building2 size={17} aria-hidden="true" /> Organisation profile</h2><p>Created {date(client.created_at)}</p></div><StatusBadge status={client.status} /></div>
        <dl className={styles.details}>{[
          ['Organisation ID', client.id], ['Business email', client.business_email], ['Contact number', client.phone], ['Workspace slug', client.slug],
          ['Owner', client.owner_name], ['Owner email', client.owner_email], ['Plan', client.plan_name || 'No plan'],
          ['Subscription status', client.subscription_status || 'None'], ['Renewal/end date', date(client.current_period_end)],
          ['Total users', count(client.user_count)],
        ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd className={key === 'Organisation ID' ? 'num' : undefined}>{value || '—'}</dd></div>)}</dl>
        {canManage && client.status !== 'archived' && <div className={styles.actions}>
          {client.status !== 'active' && client.status !== 'subscription_required' && <Button variant="secondary" onClick={() => { setReason(''); setActionError(''); setAction('activate') }}>Activate</Button>}
          {client.status !== 'suspended' && <Button variant="secondary" onClick={() => { setReason(''); setActionError(''); setAction('suspend') }}>Suspend</Button>}
          <Button variant="danger" icon={ShieldAlert} onClick={() => { setReason(''); setActionError(''); setAction('archive') }}>Archive</Button>
        </div>}
      </section>
      <section className={styles.stats} aria-label="Operational counts"><SummaryStat icon={FileText} label="Invoices" value={count(summary.invoice_count)} /><SummaryStat icon={UsersRound} label="Customers" value={count(summary.customer_count)} /><SummaryStat icon={WalletCards} label="Receipts" value={count(summary.payment_count)} /></section>
      <div className={styles.grid}>
        <PlatformCurrencyBreakdown title="Approved invoices by currency" rows={summary.approved_invoice_value_by_currency} note="Approved invoice amounts, before credits; not an outstanding-balance figure." />
        <PlatformCurrencyBreakdown title="Receipts by currency" rows={summary.payment_value_by_currency} note="Non-void receipt amounts; not a net settlement figure." />
        <PlatformCurrencyBreakdown title="Paid subscriptions by currency" rows={client.lifetime_revenue_by_currency} note="Lifetime platform subscription payments for this client." />
      </div>
      <div className={styles.grid}>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2><UsersRound size={17} aria-hidden="true" /> Workspace users</h2><p>{list(data.users).length} accounts</p></div></div><DataTable columns={usersColumns} rows={list(data.users)} empty={<div className={styles.empty}><Building2 size={24}/><strong>No users</strong></div>} /></section>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2><CreditCard size={17} aria-hidden="true" /> Recent subscriptions</h2><p>Up to eight records</p></div></div><DataTable columns={subColumns} rows={list(data.subscriptions)} empty={<div className={styles.empty}><strong>No subscription history</strong></div>} /></section>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2><WalletCards size={17} aria-hidden="true" /> Subscription payments</h2><p>Latest ten payments</p></div></div>{list(data.subscription_payments).length ? <ul className={styles.entries}>{data.subscription_payments.map((item) => <li key={item.id}><div className={styles.entryMain}><strong>{item.plan_name || 'Plan payment'}</strong><small className="ref">{item.payment_reference} · {date(item.paid_at || item.created_at)}</small></div><div className={styles.entryAside}><strong className="num">{money(item.amount, item.currency)}</strong><StatusBadge status={item.status} /></div></li>)}</ul> : <div className={styles.empty}><strong>No payments yet</strong></div>}</section>
        <section className={styles.panel}><div className={styles.panelHeading}><div><h2><Activity size={17} aria-hidden="true" /> Recent activity</h2><p>Latest ten workspace events</p></div></div>{list(data.activity).length ? <ul className={styles.entries}>{data.activity.map((item) => <li key={item.id}><div className={styles.entryMain}><strong>{item.description || item.action}</strong><small>{item.user_name || 'System'} · {date(item.created_at)}</small></div></li>)}</ul> : <div className={styles.empty}><strong>No recent activity</strong></div>}</section>
      </div>
    </>}
    <Modal open={Boolean(action)} onClose={() => !busy && setAction('')} title={ACTION_COPY[action]?.[0] || 'Update account'} description={ACTION_COPY[action]?.[1]} busy={busy} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setAction('')}>Cancel</Button><Button variant={action === 'archive' ? 'danger' : 'primary'} loading={busy} onClick={submit}>{ACTION_COPY[action]?.[2] || 'Confirm'}</Button></div>}>
      <div className={styles.form}><Textarea label="Reason (optional)" value={reason} maxLength={500} rows={3} onChange={(event) => setReason(event.target.value)} helperText="Recorded in the platform activity log. Maximum 500 characters." />{actionError && <Alert tone="danger">{actionError}</Alert>}</div>
    </Modal>
  </main>
}
