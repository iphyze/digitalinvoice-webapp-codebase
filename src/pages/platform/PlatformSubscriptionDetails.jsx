import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, RefreshCw, CalendarDays, ShieldCheck, WalletCards } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import Checkbox from '../../components/forms/Checkbox'
import Modal from '../../components/overlays/Modal'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { assertCurrencyAmounts, count, date, list, money, permission, unwrap } from './platformModel'
import PlatformCurrencyBreakdown from './PlatformCurrencyBreakdown'
import { subscriptionPayload } from './billingModel'
import styles from './PlatformAdmin.module.css'

const TITLES = {
  change_plan: ['Change plan', 'Assign a different active plan to this subscription.'],
  extend_period: ['Extend expiry', 'Set the next billing expiry date.'],
  cancel: ['Cancel subscription', 'Access to the client workspace may be restricted immediately.'],
  reactivate: ['Reactivate subscription', 'Restore an active subscription period.'],
  record_manual_payment: ['Record verified manual payment', 'Do not use unless funds were independently confirmed. This creates a paid transaction.'],
  refresh_provider: ['Refresh Paystack status', 'Retrieve subscription or transaction status from the payment provider.'],
  verify_payment: ['Verify Paystack payment', 'Check the payment reference with Paystack and apply a verified result.'],
}
const blank = () => ({ plan_id: '', reset_period: false, current_period_end: '', reason: '', note: '', amount: '', paid_at: new Date().toISOString().slice(0, 10), payment_reference: '', verified: false })
export default function PlatformSubscriptionDetails() {
  const { id } = useParams()
  const actor = useAuthStore((s) => s.user)
  const access = useAuthStore((s) => s.platformAccess)
  const toast = useToastStore((s) => s.showToast)
  const canManage = permission(access, actor, 'platform.subscriptions.manage')
  const canViewClients = permission(access, actor, 'platform.clients.view')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [action, setAction] = useState('')
  const [draft, setDraft] = useState(blank)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = unwrap(await platformService.subscription(id), ['subscription', 'client', 'plans', 'payments', 'summary'])
      assertCurrencyAmounts(response.summary?.paid_amount_by_currency)
      setData(response)
    }
    catch (err) { setData(null); setError(getErrorMessage(err, 'Unable to load subscription details.')) }
    finally { setLoading(false) }
  }, [id, revision])
  useEffect(() => { load() }, [load])
  const sub = data?.subscription || null
  const startAction = (value) => { if (!canManage || busy) return; setDraft({ ...blank(), plan_id: String(sub?.plan_id || ''), amount: String(sub?.plan_amount || ''), current_period_end: '', payment_reference: '' }); setActionError(''); setAction(value); setConfirm(false) }
  const update = (key, value) => setDraft((old) => ({ ...old, [key]: value }))
  const run = async () => {
    if (!sub || !action || !canManage) return
    let payload
    try { payload = subscriptionPayload(action, draft, sub) }
    catch (err) { setActionError(err.message); setConfirm(false); return }
    if (action === 'record_manual_payment' && !draft.verified) { setActionError('Confirm that the external payment has been independently verified.'); setConfirm(false); return }
    setBusy(true); setActionError('')
    try {
      await platformService.manageSubscription(payload)
      toast(`${TITLES[action][0]} completed.`, 'success')
      setConfirm(false); setAction(''); setRevision((n) => n + 1)
    } catch (err) { setConfirm(false); setActionError(getErrorMessage(err, 'Unable to complete subscription action.')) }
    finally { setBusy(false) }
  }
  const submit = (event) => {
    event?.preventDefault?.()
    if (busy) return
    try { subscriptionPayload(action, draft, sub) }
    catch (err) { setActionError(err.message); return }
    if (action === 'record_manual_payment' && !draft.verified) { setActionError('Confirm that payment was independently verified.'); return }
    if (['cancel', 'record_manual_payment', 'change_plan', 'reactivate', 'extend_period'].includes(action)) setConfirm(true)
    else run()
  }
  const details = sub ? [
    ['Organisation', sub.organization_name], ['Plan', sub.plan_name], ['Billing interval', sub.billing_interval],
    ['Provider', sub.provider], ['Provider reference', sub.provider_reference || '—'],
    ['Provider subscription', sub.provider_subscription_code || '—'], ['Started', date(sub.starts_at)],
    ['Current period ends', date(sub.current_period_end)], ['Cancelled', date(sub.cancelled_at)],
    ['Last payment', date(sub.last_payment_at)],
  ] : []
  const paymentCols = [
    { key: 'reference', header: 'Reference', cell: (p) => <div className={styles.rowTitle}><strong className="ref">{p.payment_reference}</strong><span>{p.provider}</span></div> },
    { key: 'amount', header: 'Amount', cell: (p) => <strong className="num">{money(p.amount, p.currency)}</strong> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'paid', header: 'Paid on', cell: (p) => <span className="num">{date(p.paid_at || p.created_at)}</span> },
  ]
  const activePlanOptions = list(data?.plans).filter((p) => p.is_active).map((p) => ({ value: String(p.id), label: `${p.name} (${p.billing_interval})` }))
  return <main className={styles.page}>
    <Link to="/platform/subscriptions" className={styles.link}><ArrowLeft size={15} aria-hidden="true" /> Back to subscriptions</Link>
    <PageHeader eyebrow="Platform billing" title={sub ? sub.organization_name : 'Subscription details'} description="Subscription status, payment history and controlled billing actions." actions={<Button icon={RefreshCw} variant="secondary" disabled={loading || busy} onClick={() => setRevision((n) => n + 1)}>Refresh</Button>} />
    {error && <Alert tone="danger" title="Subscription unavailable">{error} <Button size="sm" variant="secondary" onClick={() => setRevision((n) => n + 1)}>Try again</Button></Alert>}
    {loading ? <section className={styles.panel}><p className={styles.note}>Loading subscription and payment history…</p></section> : sub && <>
      <div className={styles.stats}>
        <SummaryStat icon={ShieldCheck} label="Status" value={<StatusBadge status={sub.status} />} />
        <SummaryStat icon={CreditCard} label="Plan price" value={money(sub.plan_amount, sub.currency)} />
        <SummaryStat icon={CalendarDays} label="Current period ends" value={date(sub.current_period_end)} />
        <SummaryStat icon={WalletCards} label="Payments recorded" value={count(data.summary?.total_payments)} />
      </div>
      <div className={styles.grid}>
        <section className={styles.panel}><div className={styles.panelHeading}><h2><CreditCard size={17} aria-hidden="true" /> Subscription information</h2><StatusBadge status={sub.status} /></div><dl className={styles.details}>{details.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value || '—'}</dd></div>)}</dl></section>
        <section className={styles.panel}><div className={styles.panelHeading}><h2><WalletCards size={17} aria-hidden="true" /> Client & payment summary</h2>{canViewClients && <Link className={styles.link} to={`/platform/clients/${sub.organization_id}`}>View client</Link>}</div><dl className={styles.details}><div><dt>Client contact</dt><dd>{data.client?.owner_name || '—'} · {data.client?.owner_email || data.client?.business_email || '—'}</dd></div><div><dt>Paid payments on this plan</dt><dd className="num">{count(data.summary?.paid_payments)}</dd></div><div><dt>Last paid</dt><dd>{date(data.summary?.last_paid_at)}</dd></div></dl><p className={styles.note}>Each payment amount is shown in its recorded currency. Cross-currency payment totals are omitted. Billing status does not certify any NRS submission.</p></section>
      </div>
      <PlatformCurrencyBreakdown title="Paid payments by currency" rows={data.summary.paid_amount_by_currency} note="Totals cover the organisation and this plan, including older subscription periods. Individual payments are shown below." />
      {canManage && <section className={styles.panel}><div className={styles.panelHeading}><div><h2><ShieldCheck size={17} aria-hidden="true" /> Subscription controls</h2><p>All actions are authorized and audited by the PHP backend. Some actions change client workspace access.</p></div></div><div className={styles.actions}>
        <Button variant="secondary" onClick={() => startAction('change_plan')}>Change plan</Button><Button variant="secondary" onClick={() => startAction('extend_period')}>Extend expiry</Button><Button variant="secondary" onClick={() => startAction('reactivate')}>Reactivate</Button>
        <Button variant="secondary" onClick={() => startAction('record_manual_payment')}>Record manual payment</Button><Button variant="secondary" onClick={() => startAction('verify_payment')}>Verify Paystack payment</Button><Button variant="secondary" onClick={() => startAction('refresh_provider')}>Refresh provider</Button><Button variant="danger" onClick={() => startAction('cancel')} disabled={sub.status === 'cancelled'}>Cancel subscription</Button>
      </div></section>}
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2><CreditCard size={17} aria-hidden="true" /> Payment history</h2><p>Latest 30 payments for this organisation and plan; these can span multiple subscription records.</p></div><CreditCard size={20} aria-hidden="true" /></div><DataTable columns={paymentCols} rows={list(data.payments)} empty={<div className={styles.empty}><CreditCard size={25} /><strong>No payment records</strong><p>No subscription payments have been recorded.</p></div>} />{list(data.payments).length >= 30 && <p className={styles.note}>Showing the latest 30 records only. This is not a complete transaction export.</p>}</section>
    </>}
    <Modal open={Boolean(action) && !confirm} title={TITLES[action]?.[0]} description={TITLES[action]?.[1]} busy={busy} onClose={() => !busy && setAction('')} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setAction('')}>Cancel</Button><Button type="submit" form="subscription-action-form" loading={busy} variant={action === 'cancel' ? 'danger' : 'primary'}>Continue</Button></div>}>
      <form id="subscription-action-form" className={styles.form} onSubmit={submit} noValidate>
        {action === 'change_plan' && <><Select label="New active plan" options={activePlanOptions} value={draft.plan_id} onChange={(value) => update('plan_id', value)} /><Checkbox label="Restart billing period" description="Recalculate the current period based on the new plan." checked={draft.reset_period} onChange={(event) => update('reset_period', event.target.checked)} /></>}
        {['extend_period', 'reactivate'].includes(action) && <DatePicker label="New expiry date" value={draft.current_period_end} onChange={(value) => update('current_period_end', value)} hint={action === 'reactivate' ? 'Optional: blank uses the plan default if the existing expiry is past.' : 'Required: must be in the future.'} />}
        {action === 'cancel' && <Textarea label="Cancellation reason (optional)" maxLength={500} rows={3} value={draft.reason} onChange={(event) => update('reason', event.target.value)} />}
        {action === 'record_manual_payment' && <><Alert tone="warning" title="Verify funds before recording">This action creates a paid subscription payment and activates the subscription; it does not charge or verify a card.</Alert><TextField label="Verified amount" inputMode="decimal" required value={draft.amount} onChange={(event) => update('amount', event.target.value)} /><DatePicker label="Payment date" value={draft.paid_at} onChange={(value) => update('paid_at', value)} /><TextField label="Payment reference (optional)" maxLength={100} value={draft.payment_reference} onChange={(event) => update('payment_reference', event.target.value)} /><DatePicker label="New expiry date (optional)" value={draft.current_period_end} onChange={(value) => update('current_period_end', value)} /><Textarea label="Internal note" rows={2} value={draft.note} onChange={(event) => update('note', event.target.value)} /><Checkbox label="I have independently confirmed receipt of this payment" checked={draft.verified} onChange={(event) => update('verified', event.target.checked)} /></>}
        {action === 'verify_payment' && <TextField label="Payment reference" hint="Leave blank to verify the latest payment." maxLength={100} value={draft.payment_reference} onChange={(event) => update('payment_reference', event.target.value)} />}
        {action === 'refresh_provider' && <p className={styles.note}>The server will query the configured Paystack subscription or latest payment reference. Provider confirmation is required before the server updates records.</p>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>
    </Modal>
    <ConfirmDialog open={confirm} title={`Confirm ${TITLES[action]?.[0]?.toLowerCase() || 'action'}?`} message={action === 'record_manual_payment' ? `Confirm the independently verified ${money(Number(draft.amount || 0), sub?.currency || 'NGN')} transaction will be recorded as paid and activate this client's subscription.` : action === 'cancel' ? 'This can immediately restrict client access. Continue only after checking the billing record.' : 'This change may affect the client subscription status, period or workspace entitlements. The backend will audit it.'} confirmLabel="Confirm action" variant={action === 'cancel' ? 'danger' : 'primary'} loading={busy} onConfirm={run} onClose={() => !busy && setConfirm(false)} />
  </main>
}
