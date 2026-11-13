import { useCallback, useEffect, useMemo, useState } from 'react'
import { MailPlus, RefreshCw, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react'
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
import teamService from '../../services/teamService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { availableRoles, canManageTeam, canModifyMember, dateLabel, unwrapTeam, validateInvitation } from './teamModel'
import styles from '../admin/AdminRegister.module.css'

const BLANK = { name: '', email: '', role: '' }

export default function TeamMembers() {
  const actor = useAuthStore((state) => state.user)
  const toast = useToastStore((state) => state.showToast)
  const [data, setData] = useState({ members: [], invitations: [], roles: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState(BLANK)
  const [inviteErrors, setInviteErrors] = useState({})
  const [editMember, setEditMember] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [actionError, setActionError] = useState('')
  const manager = canManageTeam(actor?.role)
  const roles = useMemo(() => availableRoles(data.roles), [data.roles])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(unwrapTeam(await teamService.members())) }
    catch (err) { setError(getErrorMessage(err, 'Unable to load team members.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const apply = async (action, success) => {
    setBusy(true)
    setActionError('')
    try {
      await action()
      toast(success, 'success')
      await load()
      setConfirm(null)
      setEditMember(null)
      return true
    } catch (err) {
      setActionError(getErrorMessage(err, 'The team action could not be completed.'))
      return false
    } finally { setBusy(false) }
  }

  const sendInvitation = async (event) => {
    event.preventDefault()
    const errors = validateInvitation(inviteForm, data.roles)
    setInviteErrors(errors)
    if (Object.keys(errors).length) return
    const ok = await apply(() => teamService.invite({ email: inviteForm.email.trim().toLowerCase(), name: inviteForm.name.trim() || null, role: inviteForm.role }), 'Team invitation created successfully.')
    if (ok) { setInviting(false); setInviteForm(BLANK) }
  }
  const filteredMembers = useMemo(() => data.members.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase())), [data.members, search])
  const filteredInvitations = useMemo(() => data.invitations.filter((item) => `${item.invited_name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase())), [data.invitations, search])
  const active = data.members.filter((member) => Number(member.is_active) === 1).length
  const roleName = (role) => data.roles[role]?.label || ({ owner: 'Owner', admin: 'Administrator' }[role] || String(role || 'Unknown').replaceAll('_', ' '))
  const empty = (title, message) => <div className={styles.empty}><UsersRound size={27} aria-hidden="true" /><h3>{title}</h3><p>{message}</p></div>

  const memberActions = (item) => !canModifyMember(actor, item) ? <span className={styles.muted}>—</span> : <div className={styles.rowActions}>
    <Button variant="secondary" size="sm" onClick={() => { setEditMember(item); setEditRole(item.role); setActionError('') }}>Change role</Button>
    <Button variant={Number(item.is_active) ? 'danger' : 'secondary'} size="sm" onClick={() => { setConfirm({ type: 'status', item }); setActionError('') }}>
      {Number(item.is_active) ? 'Deactivate' : 'Reactivate'}
    </Button>
  </div>
  const inviteActions = (item) => !manager ? <span className={styles.muted}>—</span> : <div className={styles.rowActions}>
    <Button variant="secondary" size="sm" onClick={() => { setConfirm({ type: 'resend', item }); setActionError('') }}>Resend</Button>
    <Button variant="danger" size="sm" onClick={() => { setConfirm({ type: 'cancel', item }); setActionError('') }}>Cancel</Button>
  </div>
  const columns = [
    { key: 'member', header: 'Team member', cell: (item) => <div className={styles.rowTitle}><strong>{item.name || 'Unnamed member'}</strong><span>{item.email}</span></div> },
    { key: 'role', header: 'Role', cell: (item) => roleName(item.role) },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={Number(item.is_active) ? 'active' : 'inactive'} /> },
    { key: 'joined', header: 'Joined', cell: (item) => <span className="num">{dateLabel(item.joined_at)}</span> },
    { key: 'last', header: 'Last sign-in', cell: (item) => <span className="num">{dateLabel(item.last_login)}</span> },
  ]
  const invitationColumns = [
    { key: 'recipient', header: 'Invited person', cell: (item) => <div className={styles.rowTitle}><strong>{item.invited_name || item.email}</strong><span>{item.email}</span></div> },
    { key: 'role', header: 'Invited role', cell: (item) => roleName(item.role) },
    { key: 'status', header: 'Status', cell: () => <StatusBadge status="pending" /> },
    { key: 'expiry', header: 'Expires', cell: (item) => <span className="num">{dateLabel(item.expires_at)}</span> },
  ]
  const confirmAction = () => {
    if (!confirm) return
    const { item, type } = confirm
    if (type === 'status') return apply(() => teamService.updateStatus({ user_id: item.id, is_active: Number(item.is_active) !== 1 }), 'Team member status updated successfully.')
    if (type === 'resend') return apply(() => teamService.resendInvitation(item.id), 'Invitation resent successfully.')
    return apply(() => teamService.cancelInvitation(item.id), 'Invitation cancelled successfully.')
  }

  return <main className={styles.page}>
    <PageHeader eyebrow="Workspace administration" title="Team members" description="Manage access, roles and pending invitations for your organisation." actions={<div className={styles.actions}>
      <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading || busy}>Refresh</Button>
      {manager && <Button icon={MailPlus} onClick={() => { setInviteForm(BLANK); setInviteErrors({}); setActionError(''); setInviting(true) }}>Invite member</Button>}
    </div>} />
    {error && <Alert tone="danger" title="Unable to load team">{error} <Button size="sm" variant="secondary" onClick={load}>Try again</Button></Alert>}
    {!error && <>
      <div className={styles.stats}>
        <SummaryStat icon={UsersRound} label="Members" value={loading ? '—' : data.members.length} tone="blue" />
        <SummaryStat icon={UserRoundCheck} label="Active members" value={loading ? '—' : active} tone="green" />
        <SummaryStat icon={MailPlus} label="Pending invitations" value={loading ? '—' : data.invitations.length} tone="amber" />
      </div>
      <div className={styles.panel}><TextField label="Search team" placeholder="Search name, email or role" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Organisation members</h2><p>Role changes and deactivation end the affected user’s active sessions.</p></div><UserRoundCheck size={20} aria-hidden="true" /></div>
        <DataTable columns={columns} rows={filteredMembers} loading={loading} actions={manager ? memberActions : undefined} empty={empty('No matching members', search ? 'Try a different search.' : 'No team members are available.')} />
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Pending invitations</h2><p>Invitations expire automatically. Accepted or cancelled links are no longer usable.</p></div><ShieldCheck size={20} aria-hidden="true" /></div>
        <DataTable columns={invitationColumns} rows={filteredInvitations} loading={loading} actions={manager ? inviteActions : undefined} empty={empty('No pending invitations', 'New invitations will appear here until accepted or expired.')} />
      </section>
    </>}
    <Modal open={inviting} onClose={() => !busy && setInviting(false)} title="Invite team member" description="An invitation link will be sent to the email address provided." busy={busy} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setInviting(false)}>Cancel</Button><Button loading={busy} type="submit" form="team-invite">Send invitation</Button></div>}>
      <form id="team-invite" className={styles.form} onSubmit={sendInvitation} noValidate>
        <TextField label="Email address" type="email" required autoComplete="email" value={inviteForm.email} error={inviteErrors.email} onChange={(event) => setInviteForm((form) => ({ ...form, email: event.target.value }))} />
        <TextField label="Name (optional)" maxLength={120} value={inviteForm.name} error={inviteErrors.name} onChange={(event) => setInviteForm((form) => ({ ...form, name: event.target.value }))} />
        <Select label="Role" options={roles} value={inviteForm.role} onChange={(role) => setInviteForm((form) => ({ ...form, role }))} error={inviteErrors.role} />
        {inviteForm.role && <p className={styles.sectionNote}>{data.roles[inviteForm.role]?.description}</p>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>
    </Modal>
    <Modal open={Boolean(editMember)} onClose={() => !busy && setEditMember(null)} title="Change member role" description={editMember ? `Updating ${editMember.name || editMember.email}. Their sessions will be revoked.` : ''} busy={busy} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setEditMember(null)}>Cancel</Button><Button loading={busy} disabled={!editRole || editRole === editMember?.role || !Object.prototype.hasOwnProperty.call(data.roles, editRole)} onClick={() => apply(() => teamService.updateRole({ user_id: editMember.id, role: editRole }), 'Team member role updated successfully.')}>Save role</Button></div>}>
      <div className={styles.form}><Select label="New role" value={editRole} options={roles} onChange={setEditRole} />{editRole && <p className={styles.sectionNote}>{data.roles[editRole]?.description}</p>}{actionError && <Alert tone="danger">{actionError}</Alert>}</div>
    </Modal>
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.type === 'status' ? `${Number(confirm.item.is_active) ? 'Deactivate' : 'Reactivate'} member?` : confirm?.type === 'resend' ? 'Resend invitation?' : 'Cancel invitation?'} message={confirm ? `${confirm.item.name || confirm.item.invited_name || confirm.item.email} — ${confirm.type === 'status' ? 'this changes account access and existing sessions.' : confirm.type === 'resend' ? 'a new invitation link will replace the old one.' : 'the current invitation link will stop working.'}` : ''} confirmLabel={confirm?.type === 'resend' ? 'Resend invitation' : confirm?.type === 'cancel' ? 'Cancel invitation' : Number(confirm?.item?.is_active) ? 'Deactivate member' : 'Reactivate member'} variant={confirm?.type === 'resend' ? 'primary' : 'danger'} loading={busy} onClose={() => !busy && setConfirm(null)} onConfirm={confirmAction} />
    {confirm && actionError && <Alert tone="danger">{actionError}</Alert>}
  </main>
}
