import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, User } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { resolveAuthenticatedStartPath } from '../../utils/appPaths'
import { getErrorMessage } from '../../utils/httpError'
import { firstError, validateInvitationForm } from '../../utils/validation'
import styles from './Recovery.module.css'
import invite from './Invitation.module.css'

/**
 * Platform (owner console) invitation (Concept A). Behaviour and copy from the
 * previous app: validate the token first, show who is invited and accept.
 * Route through MFA policy before granting owner-console access.
 */
export default function AcceptPlatformInvitation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const showToast = useToastStore((state) => state.showToast)
  const applyPayload = useAuthStore((state) => state.applyPayload)
  const [form, setForm] = useState({ name: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [invitation, setInvitation] = useState(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let mounted = true
    setChecking(true)
    setInvitation(null)
    setLoadError('')
    setSubmitted(false)
    setErrors({})
    setForm({ name: '', password: '', password_confirmation: '' })
    const check = async () => {
      if (!token) {
        setLoadError('The invitation link is missing its secure token.')
        setChecking(false)
        return
      }
      try {
        const response = await platformService.validateInvitation(token)
        const next = response.data?.data?.invitation || null
        if (!mounted) return
        if (!next?.email) {
          setLoadError('This platform invitation is invalid, expired or no longer available.')
          return
        }
        setInvitation(next)
        setForm((current) => ({ ...current, name: next.name || '' }))
      } catch (error) {
        if (mounted) setLoadError(getErrorMessage(error, 'This platform invitation is invalid, expired or no longer available.'))
      } finally {
        if (mounted) setChecking(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [token])

  const meta = useMemo(() => (invitation ? [
    { label: 'Email', value: invitation.email },
    { label: 'Role', value: invitation.platform_role_label || 'Platform admin' },
    { label: 'Invited by', value: invitation.invited_by_name || 'DigitalInvoice owner team' },
  ] : []), [invitation])

  const update = (event) => {
    const { name, value } = event.target
    const nextForm = { ...form, [name]: value }
    setForm(nextForm)
    if (submitted) setErrors(validateInvitationForm(nextForm, token))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading || checking || !invitation || loadError) return
    const nextErrors = validateInvitationForm(form, token)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      showToast(firstError(nextErrors), 'warning', 'Complete your account details')
      return
    }
    setLoading(true)
    try {
      const response = await platformService.acceptInvitation({ token, ...form })
      const payload = response.data?.data
      if (!payload?.user || !payload?.csrf_token) {
        throw new Error('The invitation was accepted, but your session could not be confirmed. Please sign in.')
      }
      applyPayload(payload)
      showToast('Your owner-console account is ready.', 'success', 'Platform invitation accepted')
      navigate(resolveAuthenticatedStartPath(payload), { replace: true })
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to accept platform invitation.')
      if ([404, 409, 410].includes(error?.response?.status)) {
        setLoadError(message)
        setInvitation(null)
      }
      showToast(message, 'error', 'Invitation not accepted')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.page} fx-stagger`}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Platform invitation</p>
        <h1 className={styles.title}>Join the owner console</h1>
        <p className={styles.lead}>Secure your account before accessing the DigitalInvoice admin console.</p>
      </header>

      {checking ? (
        <div className={invite.state} role="status">
          <Spinner size={20} />
          <span>Checking invitation…</span>
        </div>
      ) : loadError || !invitation ? (
        <div className={invite.stateError}>
          <Alert tone="danger" title="Invitation unavailable">{loadError || 'This platform invitation is invalid, expired or no longer available.'}</Alert>
          <Button to="/login" size="lg" block>Go to login</Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={invite.summary} aria-label="Invitation summary">
            <div className={invite.who}>
              <span className={invite.whoIcon}><ShieldCheck size={20} aria-hidden="true" /></span>
              <div>
                <span>You are accepting access for</span>
                <strong>{invitation?.email || 'this invited account'}</strong>
              </div>
            </div>
            {meta.length ? (
              <dl className={invite.meta}>
                {meta.slice(1).map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <TextField
            id="platform-invite-name" name="name" icon={User} autoComplete="name"
            label="Your name" value={form.name} onChange={update} error={errors.name} required
          />
          <div className={styles.passwordRow}>
            <PasswordField
              id="platform-invite-password" name="password" autoComplete="new-password"
              label="Password" value={form.password} onChange={update} error={errors.password} required
            />
            <PasswordField
              id="platform-invite-confirm" name="password_confirmation" autoComplete="new-password"
              label="Confirm password" value={form.password_confirmation} onChange={update}
              error={errors.password_confirmation} required
            />
          </div>
          <PasswordStrength value={form.password} />
          <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
            Accept invitation
          </Button>
        </form>
      )}
      <Link to="/login" className={styles.returnLink}><ArrowLeft size={16} aria-hidden="true" /> Already have access? Sign in</Link>
    </div>
  )
}
