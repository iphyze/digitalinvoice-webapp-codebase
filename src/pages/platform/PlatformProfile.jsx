import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, KeyRound, Mail, RefreshCw, Save, ShieldCheck, UserRound } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import PageLoader from '../../components/ui/PageLoader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import MfaSecurityCard from '../../components/security/MfaSecurityCard'
import platformService from '../../services/platformService'
import profileService from '../../services/profileService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { EMPTY_PASSWORD } from '../settings/profileModel'
import { parsePlatformProfile, validateProfileName, validateProfilePassword } from './platformAccountModel'
import styles from '../settings/Profile.module.css'
import account from './PlatformAccount.module.css'

function Section({ icon: Icon, title, description, children, id }) {
  return <section className={styles.panel} aria-label={title} id={id}>
    <div className={styles.panelHeading}><span className={styles.panelIcon}><Icon size={21} aria-hidden="true" /></span>
      <div><h2>{title}</h2><p>{description}</p></div></div>{children}
  </section>
}

export default function PlatformProfile() {
  const navigate = useNavigate()
  const sessionId = useAuthStore((state) => state.user?.id)
  const refreshSessionState = useAuthStore((state) => state.refreshSessionState)
  const clearSession = useAuthStore((state) => state.clearSession)
  const toast = useToastStore((state) => state.showToast)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)
  const [password, setPassword] = useState(EMPTY_PASSWORD)
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordSubmitted, setPasswordSubmitted] = useState(false)
  const [saving, setSaving] = useState('')

  // Identity only: a background session refresh must never wipe an unfinished form.
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = parsePlatformProfile(await platformService.profile())
      if (String(data.user.id) !== String(sessionId)) throw new Error('Your signed-in account changed. Please sign in again.')
      setProfile(data)
      setName(data.user.name || '')
      setNameError('')
      setNameSubmitted(false)
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to load your platform profile.'))
    } finally { setLoading(false) }
  }, [sessionId])
  useEffect(() => { if (sessionId) load() }, [load, sessionId])

  const saveName = async (event) => {
    event.preventDefault()
    if (saving || !profile) return
    setNameSubmitted(true)
    const message = validateProfileName(name)
    setNameError(message)
    if (message) return
    setSaving('name')
    try {
      const result = parsePlatformProfile(await platformService.updateProfile({ name: name.trim() }))
      setProfile(result)
      setName(result.user.name || '')
      await refreshSessionState().catch(() => null)
      toast('Your platform profile has been updated.', 'success', 'Profile saved')
    } catch (cause) { setNameError(getErrorMessage(cause, 'Unable to update your profile.')) }
    finally { setSaving('') }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (saving || !profile) return
    setPasswordSubmitted(true)
    const failures = validateProfilePassword(password, profile.user.has_password)
    setPasswordErrors(failures)
    if (Object.keys(failures).length) return
    setSaving('password')
    try {
      await profileService.changePassword(password)
      setPassword(EMPTY_PASSWORD)
      clearSession()
      toast('Password changed. Sign in again to continue.', 'success', 'Password updated')
      navigate('/login?session=password_changed', { replace: true })
    } catch (cause) { setPasswordErrors({ form: getErrorMessage(cause, 'Unable to change password.') }) }
    finally { setSaving('') }
  }

  return <main className={account.page}>
    <PageHeader eyebrow="Platform account" title="My platform profile"
      description="Manage your platform identity, sign-in methods and account security."
      actions={<Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading || Boolean(saving)}>Refresh</Button>} />
    {loading && !profile ? <PageLoader inline message="Loading your profile…" /> : null}
    {error ? <Alert tone="danger" title="Profile unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert> : null}
    {profile ? <div className={styles.content} aria-busy={loading || undefined}>
      <Section icon={UserRound} title="Personal information" description="Your display name is used in platform administration and activity records.">
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">{(profile.user.name || 'P').trim().slice(0, 1).toUpperCase()}</span>
          <div><strong>{profile.user.name}</strong><span>{profile.user.email}</span></div>
          <span className={styles.role}>{profile.platform.role_label || profile.platform.role}</span>
        </div>
        <form className={styles.form} onSubmit={saveName} noValidate>
          <TextField id="platform-profile-name" label="Full name" value={name} maxLength={120} autoComplete="name" required
            disabled={Boolean(saving)} error={nameError} onChange={(event) => { setName(event.target.value); if (nameSubmitted) setNameError(validateProfileName(event.target.value)) }} />
          <div className={styles.actionRow}><Button type="submit" icon={Save} loading={saving === 'name'} disabled={Boolean(saving)}>Save changes</Button></div>
        </form>
      </Section>
      <Section icon={Building2} title="Platform access" description="These details are managed by the platform owner and cannot be edited here.">
        <dl className={styles.details}>
          <div><dt>Organisation</dt><dd>{profile.organization.name || '—'}</dd></div>
          <div><dt>Platform role</dt><dd>{profile.platform.role_label || profile.platform.role}</dd></div>
          <div><dt>Access status</dt><dd><StatusBadge status={profile.platform.status} /></dd></div>
          <div><dt>Email verification</dt><dd>{profile.user.email_verified_at ? 'Verified' : 'Not verified'}</dd></div>
          <div><dt>Password sign-in</dt><dd>{profile.user.has_password ? 'Configured' : 'Not yet configured'}</dd></div>
          <div><dt>Last sign-in</dt><dd>{profile.user.last_login || '—'}</dd></div>
          <div className={styles.fullDetail}><dt>Connected sign-in methods</dt><dd className={styles.identities}>
            {profile.identities.length ? profile.identities.map((identity, index) => <span className={styles.identityTag} key={`${identity.provider}-${index}`}><Mail size={14} aria-hidden="true" />{identity.provider === 'google' ? 'Google' : identity.provider}</span>) : 'No external identity linked'}
          </dd></div>
        </dl>
        {profile.organization.is_platform_workspace ? <Alert tone="info">This is a platform-only account. To inspect a customer organisation, use the Clients section rather than switching to a client workspace.</Alert> : null}
      </Section>
      <Section icon={KeyRound} title={profile.user.has_password ? 'Change password' : 'Create account password'}
        description="Creating or updating a password revokes every active session, including this one.">
        <form className={styles.form} onSubmit={changePassword} noValidate>
          {profile.user.has_password ? <PasswordField id="platform-profile-current-password" label="Current password" value={password.current_password} autoComplete="current-password" required disabled={Boolean(saving)} error={passwordErrors.current_password}
            onChange={(event) => { const next = { ...password, current_password: event.target.value }; setPassword(next); if (passwordSubmitted) setPasswordErrors(validateProfilePassword(next, true)) }} /> : null}
          <div className={styles.twoColumns}>
            <PasswordField id="platform-profile-password" label="New password" value={password.password} autoComplete="new-password" required disabled={Boolean(saving)} error={passwordErrors.password}
              onChange={(event) => { const next = { ...password, password: event.target.value }; setPassword(next); if (passwordSubmitted) setPasswordErrors(validateProfilePassword(next, profile.user.has_password)) }} />
            <PasswordField id="platform-profile-confirm-password" label="Confirm new password" value={password.password_confirmation} autoComplete="new-password" required disabled={Boolean(saving)} error={passwordErrors.password_confirmation}
              onChange={(event) => { const next = { ...password, password_confirmation: event.target.value }; setPassword(next); if (passwordSubmitted) setPasswordErrors(validateProfilePassword(next, profile.user.has_password)) }} />
          </div>
          <PasswordStrength value={password.password} />
          {passwordErrors.form ? <Alert tone="danger">{passwordErrors.form}</Alert> : null}
          <div className={styles.actionRow}><Button type="submit" icon={KeyRound} loading={saving === 'password'} disabled={Boolean(saving)}>{profile.user.has_password ? 'Update password' : 'Create password'}</Button></div>
        </form>
      </Section>
      <Section icon={ShieldCheck} title="Multi-factor authentication" description="Manage your authenticator, setup key and one-time recovery codes." id="platform-mfa">
        <MfaSecurityCard hasPassword={profile.user.has_password} />
      </Section>
    </div> : null}
  </main>
}
