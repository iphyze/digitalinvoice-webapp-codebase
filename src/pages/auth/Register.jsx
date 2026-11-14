import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, LockKeyhole, Mail, UserRound, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import GoogleSignInButton from '../../components/forms/GoogleSignInButton'
import MfaSignInChallenge from '../../components/security/MfaSignInChallenge'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasSavedOnboardingProgress } from '../../utils/onboardingResume'
import {
  firstError, removeFieldError, validateRegistrationForm, validateRequired,
} from '../../utils/validation'
import common from './auth.module.css'
import styles from './Register.module.css'

const EMPTY_GOOGLE_SETUP = { open: false, credential: '', organizationName: '', error: '' }
const requiresBusinessName = (message = '') => message.toLowerCase().includes('business name is required')

/** New Concept A presentation; registration, Google setup and verification
 *  behaviour are carried over from the previous application. */
export default function Register() {
  const navigate = useNavigate()
  const registerAccount = useAuthStore((state) => state.register)
  const googleLogin = useAuthStore((state) => state.googleLogin)
  const showToast = useToastStore((state) => state.showToast)

  const [form, setForm] = useState({
    name: '', organization_name: '', email: '', password: '', password_confirmation: '',
  })
  const [errors, setErrors] = useState({})
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleSetup, setGoogleSetup] = useState(EMPTY_GOOGLE_SETUP)
  const [shake, setShake] = useState(0)
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const closeRef = useRef(null)
  const focusBeforeDialog = useRef(null)
  const googleLoadingRef = useRef(false)
  googleLoadingRef.current = googleLoading

  const update = (event) => {
    const { name, value } = event.target
    const nextForm = { ...form, [name]: value }
    setForm(nextForm)
    // Errors appear on submit, then revalidate while the user corrects them.
    setErrors((current) => hasSubmitted ? validateRegistrationForm(nextForm) : removeFieldError(current, name))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    const nextErrors = validateRegistrationForm(form)
    setHasSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setShake((n) => n + 1)
      showToast(firstError(nextErrors), 'warning', 'Complete your registration')
      return
    }

    setLoading(true)
    const result = await registerAccount(form)
    setLoading(false)
    if (!result.success) {
      showToast(result.error, 'error', 'Registration failed')
      return
    }
    if (result.data?.email_delivery_status === 'failed') {
      showToast('Your account is ready, but your verification email could not be delivered. Please request another email.', 'warning', 'Email delivery issue')
    } else {
      showToast('Account created. Check your inbox to verify your email.', 'success', 'Registration complete')
    }
    // The development URL is optional. Never send users to a verification page
    // with an empty token if a local mail transport returns a malformed URL.
    let verificationToken = null
    if (result.verificationUrl) {
      try {
        verificationToken = new URL(result.verificationUrl, window.location.origin).searchParams.get('token')
      } catch {
        // Fall back to the normal check-email flow below.
      }
    }
    if (verificationToken) {
      navigate(`/verify-email?token=${encodeURIComponent(verificationToken)}`)
    } else {
      navigate(`/check-email?email=${encodeURIComponent(form.email.trim())}`)
    }
  }

  const completeGoogleRegistration = useCallback(async (credential, organizationName = '') => {
    setGoogleLoading(true)
    const result = await googleLogin({ credential, intent: 'register', organization_name: organizationName.trim() })
    setGoogleLoading(false)
    if (result.mfaRequired) {
      setGoogleSetup(EMPTY_GOOGLE_SETUP)
      setMfaChallenge({ token: result.challengeToken, expiresInSeconds: result.expiresInSeconds })
      return result
    }
    if (!result.success) return result

    setGoogleSetup(EMPTY_GOOGLE_SETUP)
    showToast(
      result.data?.google_account_linked
        ? 'Your existing account is now connected to Google Sign-In.'
        : 'Google registration successful.',
      'success',
      result.data?.google_account_linked ? 'Google connected' : 'Account ready',
    )
    navigate(result.redirectTo, { replace: true })
    return result
  }, [googleLogin, navigate, showToast])

  const continueWithGoogle = useCallback(async (credential) => {
    const organizationName = form.organization_name.trim()
    const result = await completeGoogleRegistration(credential, organizationName)
    if (result.success || result.mfaRequired) return
    if (!organizationName && requiresBusinessName(result.error)) {
      setGoogleSetup({ open: true, credential, organizationName: '', error: '' })
      return
    }
    showToast(result.error, 'error', 'Google registration failed')
  }, [completeGoogleRegistration, form.organization_name, showToast])

  const closeGoogleSetup = useCallback(() => {
    if (googleLoadingRef.current) return
    setGoogleSetup(EMPTY_GOOGLE_SETUP)
  }, [])

  const finishGoogleSetup = async (event) => {
    event.preventDefault()
    if (googleLoading) return
    const error = validateRequired(googleSetup.organizationName, 'Business name')
    if (error) {
      setGoogleSetup((current) => ({ ...current, error }))
      return
    }
    const result = await completeGoogleRegistration(googleSetup.credential, googleSetup.organizationName)
    if (!result.success && !result.mfaRequired) showToast(result.error, 'error', 'Google registration failed')
  }

  // Escape closes the Google-business-name dialog; keyboard focus stays inside.
  useEffect(() => {
    if (!googleSetup.open) return undefined
    focusBeforeDialog.current = document.activeElement
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !googleLoadingRef.current) {
        event.preventDefault()
        closeGoogleSetup()
      }
      if (event.key !== 'Tab') return
      const dialog = closeRef.current?.closest('[role="dialog"]')
      const focusable = dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      focusBeforeDialog.current?.focus?.()
    }
  }, [googleSetup.open, closeGoogleSetup])

  const finishMfa = (result) => {
    setMfaChallenge(null)
    if (!(result.redirectTo?.startsWith('/onboarding') && hasSavedOnboardingProgress(useAuthStore.getState().onboarding))) {
      showToast('Multi-factor verification complete.', 'success', 'Welcome back')
    }
    navigate(result.redirectTo, { replace: true })
  }

  const restartSignIn = () => {
    setMfaChallenge(null)
    setGoogleSetup(EMPTY_GOOGLE_SETUP)
    navigate('/login', { replace: true })
  }

  if (mfaChallenge) {
    return (
      <MfaSignInChallenge
        key={mfaChallenge.token}
        challengeToken={mfaChallenge.token}
        expiresInSeconds={mfaChallenge.expiresInSeconds}
        onVerified={finishMfa}
        onRestart={restartSignIn}
      />
    )
  }

  return (
    <div className={`${styles.page} fx-stagger`}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Create account</p>
        <h1 className={common.title}>Start your business workspace</h1>
        <p className={styles.lead}>Register your company, select a plan and begin using secure invoicing tools.</p>
      </div>

      <form className={`${styles.form} ${shake ? 'fx-shake' : ''}`} key={shake} onSubmit={submit} noValidate>
        <TextField
          id="reg-name" name="name" icon={UserRound} autoComplete="name" label="Full name"
          placeholder="Your full name" value={form.name} onChange={update} error={errors.name} required
        />
        <TextField
          id="reg-business" name="organization_name" icon={Building2} autoComplete="organization" label="Business name"
          placeholder="Registered company name" value={form.organization_name} onChange={update}
          error={errors.organization_name} required
        />
        <TextField
          id="reg-email" name="email" type="email" icon={Mail} autoComplete="email" label="Business email"
          placeholder="you@business.com" value={form.email} onChange={update} error={errors.email} required
        />
        <div className={styles.passwordRow}>
          <PasswordField
            id="reg-password" name="password" autoComplete="new-password" label="Password"
            placeholder="Enter password" value={form.password} onChange={update} error={errors.password} required
          />
          <PasswordField
            id="reg-password-confirm" name="password_confirmation" icon={LockKeyhole}
            autoComplete="new-password" label="Confirm password" placeholder="Confirm password"
            value={form.password_confirmation} onChange={update} error={errors.password_confirmation} required
          />
        </div>
        <PasswordStrength value={form.password} />
        <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
          Create account
        </Button>
      </form>

      <div className={styles.social}>
        <div className={common.divider}><span>or register with</span></div>
        {googleLoading && !googleSetup.open ? (
          <Button variant="secondary" size="lg" block loading disabled>Connecting to Google</Button>
        ) : (
          <GoogleSignInButton onCredential={continueWithGoogle} context="signup" disabled={googleLoading || googleSetup.open} />
        )}
        <p className={styles.googleNote}>New Google users will confirm their business name before their workspace is created.</p>
      </div>

      <p className={common.switch}>Already registered? <Link to="/login">Sign in</Link></p>

      {googleSetup.open ? (
        <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeGoogleSetup() }}>
          <section className={`${styles.dialog} fx-pop`} role="dialog" aria-modal="true" aria-labelledby="google-setup-title" aria-describedby="google-setup-description">
            <button ref={closeRef} type="button" className={styles.close} onClick={closeGoogleSetup} disabled={googleLoading} aria-label="Close business setup">
              <X size={19} aria-hidden="true" />
            </button>
            <span className={styles.dialogIcon} aria-hidden="true"><Building2 size={21} /></span>
            <p className={styles.eyebrow}>One final detail</p>
            <h2 id="google-setup-title" className={styles.dialogTitle}>Name your business workspace</h2>
            <p id="google-setup-description" className={styles.dialogLead}>Google securely provided your account identity. Add the business name that will appear in your DigitalInvoice workspace.</p>
            <form onSubmit={finishGoogleSetup} className={styles.dialogForm} noValidate>
              <TextField
                id="google-business-name" name="google_business_name" icon={Building2} autoComplete="organization"
                label="Business name" placeholder="Registered company name"
                value={googleSetup.organizationName}
                onChange={(event) => setGoogleSetup((current) => ({ ...current, organizationName: event.target.value, error: '' }))}
                error={googleSetup.error} autoFocus required
              />
              <Button type="submit" size="lg" block loading={googleLoading} iconRight={ArrowRight}>Continue securely</Button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
