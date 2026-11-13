import { useCallback, useEffect, useMemo, useState } from 'react'
import { MailPlus, RefreshCw, ShieldCheck, UsersRound, CirclePause } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Modal from '../../components/overlays/Modal'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { count, date, label, list, permission, platformRoles, unwrap, validateInvite } from './platformModel'
import styles from './PlatformAdmin.module.css'
import PlatformMfaResetDialog from './PlatformMfaResetDialog'

const blankInvite = { name: '', email: '', platform_role: '' }
const metricIcons = {
  'active_platform_users': UsersRound,
  'suspended_platform_users': CirclePause,
  'owners': ShieldCheck,
  'pending_invitations': MailPlus,
}

export default function PlatformUsers() {
  const actor = useAuthStore((s) => s.user)
  const access = useAuthStore((s) => s.platformAccess)
  const toast = useToastStore((s) => s.showToast)
  const actorRole = access?.platform_role || (actor?.role === 'platform_admin' ? 'owner' : '')
  const manager = ['owner', 'admin'].includes(actorRole) && permission(access, actor, 'platform.users.manage')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState(blankInvite)
  const [validation, setValidation] = useState({})
  const [edit, setEdit] = useState(null)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('active')
  const [confirmation, setConfirmation] = useState(null)
  const [mfaTarget, setMfaTarget] = useState(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(unwrap(await platformService.users(), ['roles', 'users', 'pending_invitations', 'summary'])) }
    catch (err) { setError(getErrorMessage(err, 'Unable to load platform users.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  const roles = data?.roles || {}
  const options = useMemo(() => platformRoles(roles, actorRole), [roles, actorRole])
  const users = list(data?.users).filter((item) => `${item.name} ${item.email} ${item.platform_role}`.toLowerCase().includes(search.toLowerCase()))
  const invitations = list(data?.pending_invitations).filter((item) => `${item.name} ${item.email} ${item.platform_role}`.toLowerCase().includes(search.toLowerCase()))
  const mayEdit = (item) => manager && Number(item.user_id) !== Number(actor?.id) && (actorRole === 'owner' || item.platform_role !== 'owner')
  const run = async (fn, success) => {
    setBusy(true); setActionError('')
    try {
      await fn()
      await load()
      toast(success, 'success')
      setInviting(false); setEdit(null); setConfirmation(null)
      return true
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to complete platform user action.')); return false }
    finally { setBusy(false) }
  }
  const inviteUser = async (event) => {
    event.preventDefault()
    const errors = validateInvite(invite, roles, actorRole)
    setValidation(errors)
    if (Object.keys(errors).length) return
    const ok = await run(() => platformService.inviteUser({ name: invite.name.trim() || null, email: invite.email.trim().toLowerCase(), platform_role: invite.platform_role }), 'Platform access request processed successfully.')
    if (ok) setInvite(blankInvite)
  }
  const editUser = (item) => { setActionError(''); setEdit(item); setRole(item.platform_role); setStatus(item.status) }
  const saveUser = () => {
    if (!edit || !mayEdit(edit)) return
    if (!options.some((option) => option.value === role)) { setActionError('Select a permitted role.'); return }
    if (!['active', 'suspended'].includes(status)) { setActionError('Select a valid status.'); return }
    return run(() => platformService.updateUser({ user_id: edit.user_id, platform_role: role, status }), 'Platform user updated successfully.')
  }
  const confirmAction = () => {
    if (!confirmation || !manager) return
    const { type, item } = confirmation
    if (type === 'resend') return run(() => platformService.resendInvitation({ invitation_id: item.id }), 'Platform invitation resent successfully.')
    if (type === 'cancel') return run(() => platformService.removeUser({ invitation_id: item.id }), 'Platform invitation cancelled successfully.')
    if (type === 'remove' && mayEdit(item)) return run(() => platformService.removeUser({ user_id: item.user_id }), 'Platform user access removed successfully.')
  }
  const columns = [
    { key: 'name', header: 'Platform user', cell: (item) => <div className={styles.rowTitle}><strong>{item.name || 'Unnamed user'}</strong><span>{item.email}</span></div> },
    { key: 'role', header: 'Platform role', cell: (item) => item.platform_role_label || label(item.platform_role) },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.status} /> },
    { key: 'mfa', header: 'MFA', cell: (item) => <StatusBadge status={item.mfa_enabled ? 'active' : item.mfa_reenrol_required ? 'pending' : 'inactive'} /> },
    { key: 'last', header: 'Last access', cell: (item) => <span className="num">{date(item.last_accessed_at)}</span> },
  ]
  const pendingColumns = [
    { key: 'name', header: 'Invitee', cell: (item) => <div className={styles.rowTitle}><strong>{item.name || item.email}</strong><span>{item.email}</span></div> },
    { key: 'role', header: 'Invited role', cell: (item) => item.platform_role_label || label(item.platform_role) },
    { key: 'expires', header: 'Expires', cell: (item) => <span className="num">{date(item.expires_at)}</span> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Platform users" description="Manage internal platform access and pending invitations, separately from client workspace teams." actions={<div className={styles.actions}><Button icon={RefreshCw} variant="secondary" disabled={loading || busy} onClick={load}>Refresh</Button>{manager && <Button icon={MailPlus} onClick={() => { setInvite(blankInvite); setValidation({}); setActionError(''); setInviting(true) }}>Invite platform user</Button>}</div>} />
    {error && <Alert tone="danger" title="Platform users unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert>}
    <section className={styles.stats}>{[['Active platform users','active_platform_users'],['Suspended users','suspended_platform_users'],['Platform owners','owners'],['Pending invitations','pending_invitations']].map(([title,key]) => <SummaryStat key={key} icon={metricIcons[key] || metricIcons[title]} label={title} value={loading || error ? '—' : count(data?.summary?.[key])} />)}</section>
    <section className={styles.panel}><TextField label="Search platform users" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or role" /></section>
    {!error && <>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Platform users</h2><p>Role and suspension changes revoke affected access. At least one active owner is required.</p></div><UsersRound size={20} aria-hidden="true" /></div>
        <DataTable columns={columns} rows={users} loading={loading} actions={manager ? (item) => mayEdit(item) ? <div className={styles.rowActions}><Button size="sm" variant="secondary" onClick={() => editUser(item)}>Manage</Button>{item.mfa_enabled && item.is_active && item.status === 'active' && <Button size="sm" variant="secondary" onClick={() => setMfaTarget(item)}>Reset MFA</Button>}<Button size="sm" variant="danger" onClick={() => { setActionError(''); setConfirmation({ type: 'remove', item }) }}>Remove access</Button></div> : <span className={styles.muted}>Protected account</span> : undefined} empty={<div className={styles.empty}><UsersRound size={26} /><strong>No matching users</strong><p>No platform users match this search.</p></div>} />
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Pending invitations</h2><p>Invitation URLs are emailed and are not retrievable later.</p></div><ShieldCheck size={20} aria-hidden="true" /></div>
        <DataTable columns={pendingColumns} rows={invitations} loading={loading} actions={manager ? (item) => <div className={styles.rowActions}><Button size="sm" variant="secondary" onClick={() => { setActionError(''); setConfirmation({ type: 'resend', item }) }}>Resend</Button><Button size="sm" variant="danger" onClick={() => { setActionError(''); setConfirmation({ type: 'cancel', item }) }}>Cancel</Button></div> : undefined} empty={<div className={styles.empty}><MailPlus size={25} /><strong>No pending invitations</strong></div>} />
      </section>
    </>}
    <Modal open={inviting} title="Invite platform user" description="Grant access to an existing account or email a secure invitation to a new user." busy={busy} onClose={() => !busy && setInviting(false)} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setInviting(false)}>Cancel</Button><Button form="platform-invite" type="submit" loading={busy}>Send invitation</Button></div>}>
      <form id="platform-invite" className={styles.form} noValidate onSubmit={inviteUser}>
        <TextField label="Email address" type="email" autoComplete="email" required value={invite.email} error={validation.email} onChange={(event) => setInvite((old) => ({ ...old, email: event.target.value }))} />
        <TextField label="Name (optional)" maxLength={120} value={invite.name} error={validation.name} onChange={(event) => setInvite((old) => ({ ...old, name: event.target.value }))} />
        <Select label="Platform role" options={options} value={invite.platform_role} error={validation.platform_role} onChange={(value) => setInvite((old) => ({ ...old, platform_role: value }))} />
        {invite.platform_role && <p className={styles.note}>{roles[invite.platform_role]?.description}</p>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>
    </Modal>
    <Modal open={Boolean(edit)} title="Manage platform user" description={edit?.email || ''} onClose={() => !busy && setEdit(null)} busy={busy} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={saveUser} disabled={role === edit?.platform_role && status === edit?.status}>Save changes</Button></div>}>
      <div className={styles.form}><Select label="Platform role" options={options} value={role} onChange={setRole} /><Select label="Access status" options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} value={status} onChange={setStatus} />
        {role && <p className={styles.note}>{roles[role]?.description}</p>}{actionError && <Alert tone="danger">{actionError}</Alert>}
      </div>
    </Modal>
    <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.type === 'resend' ? 'Resend platform invitation?' : confirmation?.type === 'cancel' ? 'Cancel platform invitation?' : 'Remove platform access?'} message={confirmation ? `${confirmation.item.name || confirmation.item.email} — ${confirmation.type === 'resend' ? 'the previous link will be invalidated.' : confirmation.type === 'cancel' ? 'the invitation link will stop working.' : 'this account will lose platform access; its workspace membership is unaffected.'}` : ''} variant={confirmation?.type === 'resend' ? 'primary' : 'danger'} confirmLabel={confirmation?.type === 'resend' ? 'Resend invitation' : confirmation?.type === 'cancel' ? 'Cancel invitation' : 'Remove access'} loading={busy} onConfirm={confirmAction} onClose={() => !busy && setConfirmation(null)} />
    <PlatformMfaResetDialog target={mfaTarget} onClose={() => setMfaTarget(null)} onSuccess={async (notification) => { await load(); toast(notification === 'failed' ? 'MFA reset completed, but the security email was not delivered. Notify the user securely.' : 'User MFA reset successfully. New enrolment required.', notification === 'failed' ? 'warning' : 'success') }} />
    {confirmation && actionError && <Alert tone="danger">{actionError}</Alert>}
  </main>
}
