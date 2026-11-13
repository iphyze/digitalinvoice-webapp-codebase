import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Mail } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import PasswordField from '../../components/forms/PasswordField'
import GoogleSignInButton from '../../components/forms/GoogleSignInButton'
import MfaSignInChallenge from '../../components/security/MfaSignInChallenge'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { removeFieldError, validateLoginForm } from '../../utils/validation'
import { resolveSafePostLoginPath } from '../../utils/appPaths'
import styles from './auth.module.css'

/*
  Sign in. Behaviour and copy carried over from the previous app:
  validateLoginForm rules, useAuthStore.login / googleLogin, redirect to
  result.redirectTo, the same toast messages, and the session-expired notice
  (?reason=session_expired + the stored message), now shown inline.
*/
const SESSION_FALLBACK = 'Your session has expired. Please sign in again.'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const googleLogin = useAuthStore((s) => s.googleLogin)
  const showToast = useToastStore((s) => s.showToast)

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sessionNotice, setSessionNotice] = useState('')
  const [shake, setShake] = useState(0)
  const [mfaChallenge, setMfaChallenge] = useState(null)

  const destinationAfterSignIn = useCallback((defaultPath) => {
    const from = location.state?.from || new URLSearchParams(location.search).get('from')
    return resolveSafePostLoginPath(defaultPath, from)
  }, [location.search, location.state])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('reason') !== 'session_expired') return
    let message = SESSION_FALLBACK
    try {
      message = sessionStorage.getItem('digitalinvoice_session_expired_message') || message
      sessionStorage.removeItem('digitalinvoice_session_expired_message')
    } catch {
      // keep the fallback message
    }
    setSessionNotice(message)
  }, [location.search])

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => removeFieldError(current, name))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validateLoginForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setShake((n) => n + 1)
      return
    }
    setLoading(true)
    const result = await login(form)
    setLoading(false)
    if (result.success) {
      showToast('Welcome back to your secure workspace.', 'success', 'Welcome back')
      navigate(destinationAfterSignIn(result.redirectTo), { replace: true })
    } else if (result.mfaRequired) {
      setMfaChallenge({ token: result.challengeToken, expiresInSeconds: result.expiresInSeconds })
      setForm((current) => ({ ...current, password: '' }))
      setErrors({})
    } else {
      setShake((n) => n + 1)
      showToast(result.error, 'error', 'Sign-in failed')
    }
  }

  const signInWithGoogle = useCallback(async (credential) => {
    setGoogleLoading(true)
    const result = await googleLogin({ credential, intent: 'login' })
    setGoogleLoading(false)
    if (result.success) {
      showToast(
        result.data?.google_account_linked
          ? 'Google Sign-In is now securely connected to your existing account.'
          : 'You have signed in with Google.',
        'success',
        result.data?.google_account_linked ? 'Google connected' : 'Welcome back',
      )
      navigate(destinationAfterSignIn(result.redirectTo), { replace: true })
    } else if (result.mfaRequired) {
      setMfaChallenge({ token: result.challengeToken, expiresInSeconds: result.expiresInSeconds })
      setForm((current) => ({ ...current, password: '' }))
      setErrors({})
    } else {
      showToast(result.error, 'error', 'Google sign-in failed')
    }
  }, [googleLogin, navigate, showToast, destinationAfterSignIn])

  const finishMfa = (result) => {
    setMfaChallenge(null)
    showToast('Multi-factor verification complete.', 'success', 'Welcome back')
    navigate(destinationAfterSignIn(result.redirectTo), { replace: true })
  }

  const restartSignIn = () => {
    setMfaChallenge(null)
    setForm((current) => ({ ...current, password: '' }))
    setErrors({})
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
    <div className="fx-stagger">
      {sessionNotice ? (
        <Alert tone="session" title="Session ended" onDismiss={() => setSessionNotice('')} className={styles.notice}>
          {sessionNotice}
        </Alert>
      ) : null}

      <div>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your workspace</p>
        <p className={styles.lead}>Continue managing invoicing, payments and business reporting securely.</p>
      </div>

      <form
        key={shake}
        className={`${styles.form} ${shake ? 'fx-shake' : ''}`}
        onSubmit={submit}
        noValidate
      >
        <TextField
          id="email"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          label="Email address"
          placeholder="you@business.com"
          value={form.email}
          onChange={update}
          error={errors.email}
          required
          // Focus for mouse/trackpad users only: on phones it would pop the keyboard up immediately
          autoFocus={!sessionNotice && typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches}
        />
        <PasswordField
          id="password"
          name="password"
          autoComplete="current-password"
          label="Password"
          placeholder="Enter your password"
          action={<Link to="/forgot-password">Forgot password?</Link>}
          value={form.password}
          onChange={update}
          error={errors.password}
          required
        />
        <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
          Sign in
        </Button>
      </form>

      <div>
        <div className={styles.divider}><span>or continue securely with</span></div>
        {googleLoading ? (
          <Button variant="secondary" size="lg" block loading disabled>Connecting to Google</Button>
        ) : (
          <GoogleSignInButton onCredential={signInWithGoogle} />
        )}
      </div>

      <p className={styles.switch}>
        New to DigitalInvoice? <Link to="/register">Create a business account</Link>
      </p>
    </div>
  )
}
