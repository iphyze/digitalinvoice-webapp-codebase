import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import platformService from '../../services/platformService'
import { getErrorMessage } from '../../utils/httpError'
import styles from './PlatformAdmin.module.css'

const blank = { confirm_email: '', reason: '', current_password: '', mfa_code: '' }

/** Reauthenticated platform-only account recovery; never returns a secret or code. */
export default function PlatformMfaResetDialog({ target, onClose, onSuccess }) {
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setForm(blank); setError('') }, [target?.id])
  const valid = target && form.confirm_email.trim().toLowerCase() === target.email.toLowerCase()
    && form.reason.trim().length >= 12 && form.current_password && form.mfa_code.trim()
  const submit = async (event) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true); setError('')
    try {
      const result = await platformService.resetUserMfa({ user_id: Number(target.user_id ?? target.id),
        confirm_email: form.confirm_email.trim(), reason: form.reason.trim(),
        current_password: form.current_password, mfa_code: form.mfa_code.trim() })
      setForm(blank)
      await onSuccess?.(result?.data?.data?.notification_status)
      onClose?.()
    } catch (err) { setError(getErrorMessage(err, 'Unable to reset the user authenticator.')) }
    finally { setBusy(false) }
  }
  return <Modal open={Boolean(target)} busy={busy} onClose={onClose} title="Reset user authenticator" description={target?.email || ''}
    footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" form="platform-mfa-reset" type="submit" loading={busy} disabled={!valid}>Reset MFA</Button></div>}>
    <form id="platform-mfa-reset" className={styles.form} onSubmit={submit} autoComplete="off">
      <Alert tone="warning" title="Security-sensitive account recovery"><ShieldAlert size={17} aria-hidden="true" /> This will invalidate the user's authenticator, recovery codes and all active sessions. Their password is not changed. They must enrol a new authenticator at next sign-in. Verify their identity through your approved support process first.</Alert>
      <TextField label="Confirm the user's email" type="email" autoComplete="off" required value={form.confirm_email} onChange={(e) => setForm((s) => ({ ...s, confirm_email: e.target.value }))} hint="Enter the exact email address shown above." />
      <Textarea label="Identity-verification reason" required rows={3} maxLength={500} value={form.reason} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))} hint="12–500 characters. This is retained in the security audit log." />
      <TextField label="Your current administrator password" type="password" autoComplete="current-password" required value={form.current_password} onChange={(e) => setForm((s) => ({ ...s, current_password: e.target.value }))} />
      <TextField label="Your authenticator or recovery code" type="text" autoComplete="one-time-code" required value={form.mfa_code} onChange={(e) => setForm((s) => ({ ...s, mfa_code: e.target.value }))} hint="A current six-digit code or one unused recovery code from your own account." />
      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  </Modal>
}
