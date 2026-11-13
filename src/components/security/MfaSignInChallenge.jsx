import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import TextField from '../forms/TextField'
import MfaCodeInput from './MfaCodeInput'
import { completeMfaCode, emptyMfaDigits } from './mfaCodeUtils'
import useAuthStore from '../../stores/useAuthStore'
import styles from './MfaSignInChallenge.module.css'

const MAX_ATTEMPTS = 5
const isInvalidCode = (message) => /incorrect authentication or recovery code/i.test(message)
const isExpiredChallenge = (message) => /verification expired|invalid or expired verification request|configuration has changed|no longer available/i.test(message)
const remainingLabel = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Shared second-factor sign-in step for password and Google entry points.
 * Keeps the short-lived challenge and recovery code in component memory only.
 * A session is created by the backend ONLY after verifyMfa succeeds.
 */
export default function MfaSignInChallenge({
  challengeToken,
  expiresInSeconds = 300,
  onVerified,
  onRestart,
}) {
  const verifyMfa = useAuthStore((state) => state.verifyMfa)
  const [digits, setDigits] = useState(emptyMfaDigits)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [terminal, setTerminal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expiresAt] = useState(() => Date.now() + Math.max(1, Number(expiresInSeconds) || 300) * 1000)
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(1, Number(expiresInSeconds) || 300))

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const expired = secondsLeft <= 0
  const exhausted = failedAttempts >= MAX_ATTEMPTS
  const unavailable = expired || exhausted || terminal
  const inputDisabled = loading || unavailable
  const changeMode = () => {
    setRecoveryMode((current) => !current)
    setDigits(emptyMfaDigits())
    setRecoveryCode('')
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading || unavailable) return
    const code = recoveryMode ? recoveryCode.trim() : completeMfaCode(digits)
    if (!code) {
      setError(recoveryMode ? 'Enter a recovery code.' : 'Enter a six-digit authenticator code.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const result = await verifyMfa({ challenge_token: challengeToken, code })
      if (result.success) {
        setRecoveryCode('')
        setDigits(emptyMfaDigits())
        onVerified(result)
        return
      }
      const message = result.error || 'Unable to verify your code.'
      setError(message)
      if (isInvalidCode(message)) setFailedAttempts((current) => Math.min(MAX_ATTEMPTS, current + 1))
      if (isExpiredChallenge(message) || result.status === 429) setTerminal(true)
      // A failed attempt never creates a session. Keep the user on this step.
    } catch {
      setError('Unable to verify your code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const changeDigits = (value) => {
    setDigits(value)
    setError('')
  }

  return (
    <section className={`${styles.page} fx-stagger`} aria-labelledby="mfa-signin-title">
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true"><ShieldCheck size={22} /></span>
        <p className={styles.eyebrow}>Verify your identity</p>
        <h1 id="mfa-signin-title" className={styles.title}>Two-step verification</h1>
        <p className={styles.lead}>
          Enter the 6-digit code from your authenticator app, or use one of your saved recovery codes.
          Each recovery code works only once. The challenge expires after 5 minutes.
        </p>
      </div>

      <div className={styles.timer} aria-label="Verification time remaining">
        <span>Time remaining</span>
        <strong className="num" aria-live="off">{remainingLabel(secondsLeft)}</strong>
      </div>

      {unavailable ? (
        <Alert tone="warning" title="Start sign-in again">
          {expired
            ? 'Verification expired. Please sign in again.'
            : exhausted
              ? 'You have used all five verification attempts. Please sign in again.'
              : error || 'This verification request is no longer available. Please sign in again.'}
        </Alert>
      ) : null}

      <form onSubmit={submit} className={styles.form} noValidate>
        {recoveryMode ? (
          <TextField
            id="mfa-signin-recovery"
            label="Recovery code"
            icon={KeyRound}
            placeholder="Enter a saved recovery code"
            value={recoveryCode}
            onChange={(event) => { setRecoveryCode(event.target.value); setError('') }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            error={!unavailable ? error : ''}
            disabled={inputDisabled}
            required
          />
        ) : (
          <MfaCodeInput
            digits={digits}
            onChange={changeDigits}
            disabled={inputDisabled}
            error={!unavailable ? error : ''}
          />
        )}

        {!unavailable ? (
          <>
            <div className={styles.assist}>
              <span className={styles.attempts}>
                {failedAttempts > 0 ? `${MAX_ATTEMPTS - failedAttempts} verification attempts remaining` : 'Your code stays private.'}
              </span>
              <button type="button" className={styles.mode} onClick={changeMode} disabled={loading}>
                {recoveryMode ? 'Use authenticator code' : 'Use a recovery code'}
              </button>
            </div>
            <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight}>
              Verify &amp; sign in
            </Button>
          </>
        ) : null}
      </form>

      <div className={styles.restart}>
        <Button variant="secondary" size="md" icon={ArrowLeft} onClick={onRestart} disabled={loading}>
          Start sign-in again
        </Button>
      </div>
    </section>
  )
}
