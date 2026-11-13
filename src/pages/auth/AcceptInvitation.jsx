import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, User } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import teamService from '../../services/teamService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { resolveAuthenticatedStartPath } from '../../utils/appPaths'
import { getErrorMessage } from '../../utils/httpError'
import { firstError, validateInvitationForm } from '../../utils/validation'
import styles from './Recovery.module.css'
import invite from './Invitation.module.css'

/** Public team invitation, validated before showing the account-creation form. */
export default function AcceptInvitation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const applyPayload = useAuthStore((state) => state.applyPayload)
  const showToast = useToastStore((state) => state.showToast)
  const [form, setForm] = useState({ name: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [invitation, setInvitation] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setChecking(true)
    setInvitation(null)
    setLoadError('')
    setForm({ name: '', password: '', password_confirmation: '' })
    setErrors({})
    setSubmitted(false)

    if (!token) {
      setLoadError('The invitation link is missing its secure token.')
      setChecking(false)
      return () => { active = false }
    }

    teamService.validateInvitation(token)
      .then((response) => {
        if (!active) return
        const details = response.data?.data?.invitation
        if (!details?.email) {
          setLoadError('This invitation is invalid, expired or no longer available.')
          return
        }
        setInvitation(details)
        setForm((current) => ({ ...current, name: details.invited_name || '' }))
      })
      .catch((error) => {
        if (active) setLoadError(getErrorMessage(error, 'This invitation is invalid, expired or no longer available.'))
      })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token])

  const metadata = useMemo(() => (invitation ? [
    { label: 'Organisation', value: invitation.organization_name },
    { label: 'Role', value: invitation.role_label || invitation.role },
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
      const response = await teamService.acceptInvitation({ token, ...form })
      const payload = response.data?.data
      if (!payload?.user || !payload?.csrf_token) {
        throw new Error('The invitation was accepted, but your session could not be confirmed. Please sign in.')
      }
      applyPayload(payload)
      showToast('Your DigitalInvoice account is ready.', 'success', 'Invitation accepted')
      navigate(resolveAuthenticatedStartPath(payload), { replace: true })
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to accept invitation.')
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
        <p className={styles.eyebrow}>Team invitation</p>
        <h1 className={styles.title}>Join the workspace</h1>
        <p className={styles.lead}>Secure your account before accessing your organisation&apos;s invoices.</p>
      </header>

      {checking ? (
        <div className={invite.state} role="status">
          <Spinner size={20} />
          <span>Checking invitation…</span>
        </div>
      ) : loadError || !invitation ? (
        <div className={invite.stateError}>
          <Alert tone="danger" title="Invitation unavailable">
            {loadError || 'This invitation is invalid, expired or no longer available.'}
          </Alert>
          <Button to="/login" size="lg" block>Go to login</Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <div className={invite.summary} aria-label="Invitation summary">
            <div className={invite.who}>
              <span className={invite.whoIcon}><Building2 size={20} aria-hidden="true" /></span>
              <div>
                <span>You are accepting access for</span>
                <strong>{invitation.email}</strong>
              </div>
            </div>
            <dl className={invite.meta}>
              {metadata.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
          <TextField
            id="invite-name" name="name" icon={User} autoComplete="name"
            label="Your name" value={form.name} onChange={update} error={errors.name} required
          />
          <div className={styles.passwordRow}>
            <PasswordField
              id="invite-password" name="password" autoComplete="new-password"
              label="Password" value={form.password} onChange={update} error={errors.password} required
            />
            <PasswordField
              id="invite-confirm" name="password_confirmation" autoComplete="new-password"
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
      <Link to="/login" className={styles.returnLink}>
        <ArrowLeft size={16} aria-hidden="true" /> Sign in instead
      </Link>
    </div>
  )
}
