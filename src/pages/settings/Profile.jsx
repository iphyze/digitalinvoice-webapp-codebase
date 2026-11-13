import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, KeyRound, Mail, RefreshCw, Save, ShieldCheck, UserRound } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import PageLoader from '../../components/ui/PageLoader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import MfaSecurityCard from '../../components/security/MfaSecurityCard'
import profileService from '../../services/profileService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { EMPTY_PASSWORD, parseProfile, roleLabel, validateProfileName, validateProfilePassword } from './profileModel'
import styles from './Profile.module.css'

function Panel({ icon: Icon, title, description, children, id }) {
  return (
    <section id={id} className={styles.panel} aria-label={title}>
      <div className={styles.panelHeading}>
        <span className={styles.panelIcon}><Icon size={21} aria-hidden="true" /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      {children}
    </section>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const sessionId = useAuthStore((state) => state.user?.id)
  const clearSession = useAuthStore((state) => state.clearSession)
  const refreshSessionState = useAuthStore((state) => state.refreshSessionState)
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

  // Only user identity is a dependency; a background session refresh must not
  // reset a half-completed form or re-fetch security details unnecessarily.
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = parseProfile(await profileService.getProfile())
      if (String(result.user.id) !== String(sessionId)) throw new Error('Your account changed. Please reload this page.')
      setProfile(result)
      setName(result.user.name || '')
      setNameError('')
      setNameSubmitted(false)
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to load your profile.'))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { if (sessionId) load() }, [sessionId, load])

  const updateName = (value) => {
    setName(value)
    if (nameSubmitted) setNameError(validateProfileName(value))
  }

  const updatePassword = (field, value) => {
    const next = { ...password, [field]: value }
    setPassword(next)
    if (passwordSubmitted) setPasswordErrors(validateProfilePassword(next, profile?.user?.has_password))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (saving || !profile) return
    setNameSubmitted(true)
    const invalid = validateProfileName(name)
    setNameError(invalid)
    if (invalid) return
    setSaving('profile')
    try {
      const result = parseProfile(await profileService.updateProfile({ name: name.trim() }))
      setProfile(result)
      setName(result.user.name || '')
      // The profile endpoint does not update the session object. Refresh the
      // cached name without changing the successfully saved input if refresh fails.
      await refreshSessionState().catch(() => null)
      toast('Your profile has been updated.', 'success', 'Profile saved')
    } catch (cause) {
      setNameError(getErrorMessage(cause, 'Unable to update your profile.'))
    } finally {
      setSaving('')
    }
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
      // PHP revokes all sessions and clears the cookies. Do not fetch any
      // protected endpoint or claim the user remains signed in after this.
      setPassword(EMPTY_PASSWORD)
      clearSession()
      toast('Password changed. Sign in again to continue.', 'success', 'Password updated')
      navigate('/login?session=password_changed', { replace: true })
    } catch (cause) {
      setPasswordErrors({ form: getErrorMessage(cause, 'Unable to change password.') })
    } finally {
      setSaving('')
    }
  }

  return (
    <main className={styles.page}>
      <PageHeader eyebrow="Account" title="My profile" description="Manage your personal details, sign-in credentials and account security."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading || Boolean(saving)}>Refresh</Button>} />
      {loading && !profile ? <PageLoader inline message="Loading your profile…" /> : null}
      {error ? <Alert tone="danger" title="Profile unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert> : null}
      {profile ? (
        <div className={styles.content} aria-busy={loading || undefined}>
          <Panel icon={UserRound} title="Personal information" description="Your name appears on your account and in workspace activity records.">
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">{(profile.user.name || 'D').trim().charAt(0).toUpperCase()}</span>
              <div><strong>{profile.user.name}</strong><span>{profile.user.email}</span></div>
              <span className={styles.role}>{roleLabel(profile.user.role)}</span>
            </div>
            <form className={styles.form} onSubmit={saveProfile} noValidate>
              <TextField id="profile-name" label="Full name" value={name} onChange={(event) => updateName(event.target.value)}
                autoComplete="name" maxLength={120} error={nameError} disabled={Boolean(saving)} required />
              <div className={styles.actionRow}><Button type="submit" icon={Save} loading={saving === 'profile'} disabled={Boolean(saving)}>Save changes</Button></div>
            </form>
          </Panel>
          <Panel icon={Building2} title="Account & sign-in" description="Your account identity and connected sign-in methods are read-only here.">
            <dl className={styles.details}>
              <div><dt>Email address</dt><dd>{profile.user.email || '—'}</dd></div>
              <div><dt>Organisation</dt><dd>{profile.organization?.name || '—'}</dd></div>
              <div><dt>Role</dt><dd>{roleLabel(profile.user.role)}</dd></div>
              <div><dt>Password sign-in</dt><dd>{profile.user.has_password ? 'Available' : 'Not yet configured'}</dd></div>
              <div className={styles.fullDetail}><dt>Connected accounts</dt><dd className={styles.identities}>
                {profile.identities.length ? profile.identities.map((identity, index) => <span className={styles.identityTag} key={`${identity.provider}-${index}`}><Mail size={14} aria-hidden="true" /> {identity.provider === 'google' ? 'Google' : roleLabel(identity.provider)}</span>) : 'No external identity linked'}
              </dd></div>
            </dl>
          </Panel>
          <Panel icon={KeyRound} title={profile.user.has_password ? 'Change password' : 'Create account password'}
            description={profile.user.has_password ? 'Updating your password signs out every device, including this session.' : 'Add a password to manage your authenticator. You will sign in again afterwards.'}>
            <form className={styles.form} onSubmit={changePassword} noValidate>
              {profile.user.has_password ? <PasswordField id="profile-current-password" label="Current password" value={password.current_password}
                onChange={(event) => updatePassword('current_password', event.target.value)}
                error={passwordErrors.current_password} autoComplete="current-password" disabled={Boolean(saving)} required /> : null}
              <div className={styles.twoColumns}>
                <PasswordField id="profile-new-password" label="New password" value={password.password}
                  onChange={(event) => updatePassword('password', event.target.value)} error={passwordErrors.password}
                  autoComplete="new-password" disabled={Boolean(saving)} required />
                <PasswordField id="profile-confirm-password" label="Confirm new password" value={password.password_confirmation}
                  onChange={(event) => updatePassword('password_confirmation', event.target.value)}
                  error={passwordErrors.password_confirmation} autoComplete="new-password" disabled={Boolean(saving)} required />
              </div>
              <PasswordStrength value={password.password} />
              {passwordErrors.form ? <Alert tone="danger">{passwordErrors.form}</Alert> : null}
              <Alert tone="info" title="Security reminder">Changing or creating a password revokes every active session. Sign in again using your updated credentials.</Alert>
              <div className={styles.actionRow}><Button type="submit" icon={KeyRound} loading={saving === 'password'} disabled={Boolean(saving)}>{profile.user.has_password ? 'Update password' : 'Create password'}</Button></div>
            </form>
          </Panel>
          <Panel id="account-mfa" icon={ShieldCheck} title="Multi-factor authentication" description="Protect your account with a six-digit authenticator code and one-time recovery codes.">
            <MfaSecurityCard hasPassword={profile.user.has_password} />
          </Panel>
        </div>
      ) : null}
    </main>
  )
}
