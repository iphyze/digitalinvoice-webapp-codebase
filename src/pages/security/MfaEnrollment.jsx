import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowRight, Check, CheckCircle2, Clipboard, Copy, Download,
  KeyRound, LockKeyhole, LogOut, RotateCcw, ShieldCheck, Smartphone,
} from 'lucide-react'
import Logo from '../../components/brand/Logo'
import MfaCodeInput from '../../components/security/MfaCodeInput'
import { completeMfaCode, emptyMfaDigits } from '../../components/security/mfaCodeUtils'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import PageLoader from '../../components/ui/PageLoader'
import ThemeToggle from '../../components/ui/ThemeToggle'
import mfaService from '../../services/mfaService'
import profileService from '../../services/profileService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { validatePassword } from '../../utils/validation'
import styles from './MfaEnrollment.module.css'

const SETUP_LABEL = 'Authenticator setup key'

const validateNewPassword = ({ password, password_confirmation: confirmation }) => ({
  password: validatePassword(password),
  password_confirmation: !confirmation
    ? 'Confirm your new password.'
    : password !== confirmation ? 'Passwords do not match.' : '',
})

export default function MfaEnrollment() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const clearSession = useAuthStore((state) => state.clearSession)
  const refreshSessionState = useAuthStore((state) => state.refreshSessionState)
  const showToast = useToastStore((state) => state.showToast)
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [busy, setBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState({ password: '', password_confirmation: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordSubmitted, setPasswordSubmitted] = useState(false)
  const [setupKey, setSetupKey] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [digits, setDigits] = useState(emptyMfaDigits)
  const [codeError, setCodeError] = useState('')
  const [keyCopied, setKeyCopied] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [codesCopied, setCodesCopied] = useState(false)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError('')
    try {
      const response = await mfaService.status()
      const accountStatus = response.data?.data
      if (!accountStatus || typeof accountStatus.has_password !== 'boolean') {
        throw new Error('Incomplete account security status. Please try again.')
      }
      setStatus(accountStatus)
    } catch (error) {
      setStatusError(getErrorMessage(error, 'Unable to retrieve account security status.'))
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  useEffect(() => {
    if (!expiresAt || !setupKey || recoveryCodes.length) return undefined
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [expiresAt, setupKey, recoveryCodes.length])

  // The backend signs out every session on successful confirmation; codes must
  // remain in memory and visible until the user explicitly acknowledges saving.
  useEffect(() => {
    if (!recoveryCodes.length) return undefined
    const warnBeforeLeaving = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [recoveryCodes.length])

  const copyText = async (value, success) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(value)
      showToast(success, 'success', 'Copied')
      return true
    } catch {
      showToast('Could not copy automatically. Select and copy the text manually.', 'warning', 'Copy unavailable')
      return false
    }
  }

  const updateNewPassword = (event) => {
    const next = { ...newPassword, [event.target.name]: event.target.value }
    setNewPassword(next)
    if (passwordSubmitted) setPasswordErrors(validateNewPassword(next))
  }

  const createInitialPassword = async (event) => {
    event.preventDefault()
    if (busy) return
    const nextErrors = validateNewPassword(newPassword)
    setPasswordSubmitted(true)
    setPasswordErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setBusy(true)
    setRequestError('')
    try {
      await profileService.changePassword(newPassword)
      // PUT /user/password revokes every session and clears cookies. Do not
      // call logout again or assume the user remains signed in.
      clearSession()
      showToast('Password created. Sign in again and finish authenticator enrolment.', 'success', 'Password ready')
      navigate('/login', { replace: true })
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Unable to create an account password.'))
    } finally {
      setBusy(false)
    }
  }

  const startSetup = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!currentPassword) {
      setRequestError('Enter your current password to continue.')
      return
    }
    if (status?.setup_readiness?.ready === false) return
    setBusy(true)
    setRequestError('')
    try {
      const response = await mfaService.setup(currentPassword)
      const result = response.data?.data || {}
      if (!result.secret || !result.otpauth_uri) {
        throw new Error('Authenticator setup details were not returned. Try again.')
      }
      setSetupKey(result.secret)
      setOtpauthUri(result.otpauth_uri)
      setExpiresAt(Date.now() + Math.max(1, Number(result.expires_in_seconds) || 600) * 1000)
      setSecondsLeft(Math.max(1, Number(result.expires_in_seconds) || 600))
      setDigits(emptyMfaDigits())
      setCodeError('')
      setCurrentPassword('')
      setKeyCopied(false)
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Unable to start authenticator setup.'))
    } finally {
      setBusy(false)
    }
  }

  const restartSetup = () => {
    setSetupKey('')
    setOtpauthUri('')
    setExpiresAt(0)
    setSecondsLeft(0)
    setDigits(emptyMfaDigits())
    setCodeError('')
    setRequestError('')
    setKeyCopied(false)
  }

  const confirmSetup = async (event) => {
    event.preventDefault()
    if (busy) return
    const code = completeMfaCode(digits)
    if (!code) {
      setCodeError('Enter all six digits from your authenticator app.')
      return
    }
    if (secondsLeft <= 0) {
      setCodeError('Enrollment expired. Start setup again.')
      return
    }
    setBusy(true)
    setRequestError('')
    setCodeError('')
    try {
      const response = await mfaService.confirm(code)
      const result = response.data?.data || {}
      if (!result.signed_out || !Array.isArray(result.recovery_codes) || !result.recovery_codes.length) {
        // The server may already have enabled MFA and revoked this session.
        // Never offer a retry of the same consumed setup challenge.
        clearSession()
        showToast('The setup response was incomplete. Sign in again to review your MFA status or contact support.', 'warning', 'Review account security')
        navigate('/login', { replace: true })
        return
      }
      setRecoveryCodes(result.recovery_codes)
      setSetupKey('')
      setOtpauthUri('')
      setCurrentPassword('')
      setDigits(emptyMfaDigits())
      setExpiresAt(0)
      showToast('MFA enabled. Save the recovery codes before signing in again.', 'success', 'MFA enabled')
    } catch (error) {
      setRequestError(getErrorMessage(error, 'Unable to confirm authenticator setup.'))
    } finally {
      setBusy(false)
    }
  }

  const downloadCodes = () => {
    const blob = new Blob([`DigitalInvoice MFA recovery codes\n${recoveryCodes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'digitalinvoice-mfa-recovery-codes.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const finish = () => {
    if (!acknowledged) return
    setRecoveryCodes([])
    clearSession()
    navigate('/login', { replace: true })
  }

  const signOut = async () => {
    if (signingOut || busy || recoveryCodes.length) return
    setSigningOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  const hasRecoveryCodes = recoveryCodes.length > 0
  const isCreatingPassword = status && !status.has_password && !hasRecoveryCodes
  const isConfirming = Boolean(setupKey && otpauthUri && !hasRecoveryCodes)
  const isEnabled = status?.enabled && !hasRecoveryCodes
  const step = hasRecoveryCodes ? 3 : isConfirming ? 2 : 1
  const expired = isConfirming && secondsLeft <= 0

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Logo variant="full" height={36} />
        <div className={styles.topActions}>
          <ThemeToggle />
          {!hasRecoveryCodes ? (
            <Button variant="ghost" icon={LogOut} disabled={busy || signingOut} loading={signingOut} onClick={signOut}>
              Sign out
            </Button>
          ) : null}
        </div>
      </header>

      <section className={`${styles.content} fx-enter`} aria-labelledby="mfa-title">
        <div className={styles.intro}>
          <span className={styles.heroIcon} aria-hidden="true"><ShieldCheck size={28} /></span>
          <p className={styles.eyebrow}>Account security</p>
          <h1 id="mfa-title">Secure your account to continue</h1>
          <p className={styles.description}>
            Authenticator MFA is required for accounts with elevated access. You can only complete security enrolment and sign out until it is enabled.
          </p>
        </div>

        <ol className={styles.steps} aria-label="Authenticator enrolment progress">
          {[
            ['1', 'Prepare account'],
            ['2', 'Authenticator'],
            ['3', 'Recovery codes'],
          ].map(([number, label], index) => (
            <li key={number} className={styles.step} data-active={step === index + 1} data-complete={step > index + 1}>
              <span className={styles.stepNumber}>{step > index + 1 ? <Check size={15} aria-hidden="true" /> : number}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className={styles.card}>
          {statusLoading ? (
            <div className={styles.loading}><PageLoader inline message="Loading your account security settings…" /></div>
          ) : statusError ? (
            <div className={styles.stack}>
              <Alert tone="danger" title="Security settings unavailable">{statusError}</Alert>
              <Button variant="secondary" icon={RotateCcw} onClick={loadStatus}>Try again</Button>
            </div>
          ) : hasRecoveryCodes ? (
            <div className={styles.stack}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><CheckCircle2 size={22} aria-hidden="true" /></span>
                <div>
                  <h2>Save your recovery codes now</h2>
                  <p>These codes are shown only once. Each can be used for one sign-in. Keep them in a password manager, never in a shared document.</p>
                </div>
              </div>
              <Alert tone="warning" title="Keep this page open">
                All sessions have been signed out. Save your codes before leaving this page; they cannot be shown again.
              </Alert>
              <div className={styles.recoveryGrid} aria-label="One-time MFA recovery codes">
                {recoveryCodes.map((code, index) => <code className={styles.recoveryCode} key={code}><span>{index + 1}.</span>{code}</code>)}
              </div>
              <div className={styles.actionRow}>
                <Button variant="secondary" icon={Copy} onClick={async () => setCodesCopied(await copyText(recoveryCodes.join('\n'), 'Recovery codes copied.'))}>
                  {codesCopied ? 'Copied codes' : 'Copy all codes'}
                </Button>
                <Button variant="secondary" icon={Download} onClick={downloadCodes}>Save codes to a file</Button>
              </div>
              <label className={styles.acknowledgement}>
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                <span>I have saved my recovery codes somewhere safe.</span>
              </label>
              <Button size="lg" block iconRight={ArrowRight} disabled={!acknowledged} onClick={finish}>
                I've saved my codes — sign in again
              </Button>
            </div>
          ) : isEnabled ? (
            <div className={styles.stack}>
              <Alert tone="success" title="Authenticator MFA is already enabled">
                Refresh your account session to continue. If the session has ended, sign in again.
              </Alert>
              <Button onClick={async () => {
                setBusy(true)
                try { await refreshSessionState() } catch (error) {
                  setRequestError(getErrorMessage(error, 'Unable to refresh your session. Sign in again.'))
                } finally { setBusy(false) }
              }} loading={busy}>Refresh account status</Button>
              {requestError ? <Alert tone="danger">{requestError}</Alert> : null}
            </div>
          ) : isCreatingPassword ? (
            <form className={styles.stack} onSubmit={createInitialPassword} noValidate>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><LockKeyhole size={22} aria-hidden="true" /></span>
                <div>
                  <h2>First, create an account password</h2>
                  <p>Your Google account has no password yet. Set one to activate an authenticator securely. You will sign in again afterwards.</p>
                </div>
              </div>
              {requestError ? <Alert tone="danger" title="Could not create password">{requestError}</Alert> : null}
              <PasswordField
                id="forced-mfa-password" name="password" label="New password" autoComplete="new-password"
                placeholder="Enter your new password" value={newPassword.password} onChange={updateNewPassword}
                error={passwordErrors.password} disabled={busy} required
              />
              <PasswordField
                id="forced-mfa-confirm" name="password_confirmation" label="Confirm new password" autoComplete="new-password"
                placeholder="Confirm your new password" value={newPassword.password_confirmation}
                onChange={updateNewPassword} error={passwordErrors.password_confirmation} disabled={busy} required
              />
              <PasswordStrength value={newPassword.password} />
              <Button type="submit" block size="lg" loading={busy} iconRight={ArrowRight}>Create password</Button>
            </form>
          ) : isConfirming ? (
            <div className={styles.stack}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><Smartphone size={22} aria-hidden="true" /></span>
                <div>
                  <h2>Connect your authenticator app</h2>
                  <p>Open your authenticator app, choose <strong>Add account</strong>, then <strong>Scan QR code</strong>.</p>
                </div>
              </div>
              {requestError ? <Alert tone="danger" title="Setup not confirmed">{requestError}</Alert> : null}
              <div className={styles.qrPanel}>
                <div className={styles.qrCanvas}>
                  <QRCodeSVG value={otpauthUri} size={188} level="M" marginSize={0} bgColor="#ffffff" fgColor="#0a1e45" title="DigitalInvoice authenticator QR code" />
                </div>
                <p>Scan this QR code with your authenticator app.</p>
              </div>
              <div className={styles.manualKey}>
                <p>Can't scan? Enter this setup key manually (shown only during enrolment):</p>
                <div className={styles.keyBox}>
                  <code aria-label={SETUP_LABEL}>{setupKey}</code>
                  <button
                    type="button" className={styles.copyButton} aria-label={keyCopied ? 'Setup key copied' : 'Copy authenticator setup key'}
                    title={keyCopied ? 'Copied' : 'Copy setup key'}
                    onClick={async () => setKeyCopied(await copyText(setupKey, 'Authenticator setup key copied.'))}
                  >{keyCopied ? <Check size={19} aria-hidden="true" /> : <Clipboard size={19} aria-hidden="true" />}</button>
                </div>
                <a className={styles.appLink} href={otpauthUri}>Open authenticator app on this device</a>
                <p className={styles.expiry}>
                  {expired ? 'The setup key has expired. Start again to generate a new one.' : `The setup key expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}. Never share it with anyone.`}
                </p>
              </div>
              {!expired ? (
                <form className={styles.confirmForm} onSubmit={confirmSetup} noValidate>
                  <MfaCodeInput digits={digits} disabled={busy} error={codeError} onChange={(value) => { setDigits(value); setCodeError('') }} />
                  <Button type="submit" block size="lg" loading={busy} iconRight={ArrowRight}>Confirm and enable MFA</Button>
                </form>
              ) : null}
              <Button variant="ghost" block icon={RotateCcw} disabled={busy} onClick={restartSetup}>
                {expired ? 'Start setup again' : 'Use a different setup key'}
              </Button>
            </div>
          ) : (
            <form className={styles.stack} onSubmit={startSetup} noValidate>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><KeyRound size={22} aria-hidden="true" /></span>
                <div>
                  <h2>Set up authenticator MFA</h2>
                  <p>MFA is currently disabled. Enter your current password to generate an authenticator key.</p>
                </div>
              </div>
              {status?.policy?.required ? <Alert tone="info" title="Required for your role">Authenticator MFA cannot be disabled on this account.</Alert> : null}
              {status?.setup_readiness?.ready === false ? (
                <Alert tone="danger" title="Setup unavailable">{status.setup_readiness.message} This must be fixed on the backend server; entering another password will not resolve it.</Alert>
              ) : null}
              {requestError ? <Alert tone="danger" title="Unable to start setup">{requestError}</Alert> : null}
              <PasswordField
                id="mfa-current-password" name="current_password" autoComplete="current-password" label="Current password"
                placeholder="Enter your current password" value={currentPassword}
                onChange={(event) => { setCurrentPassword(event.target.value); setRequestError('') }} disabled={busy} required
              />
              <Button type="submit" block size="lg" loading={busy} iconRight={ArrowRight} disabled={status?.setup_readiness?.ready === false}>
                Set up authenticator MFA
              </Button>
            </form>
          )}
        </div>
        <p className={styles.footerNote}>
          <ShieldCheck size={15} aria-hidden="true" /> Protect your DigitalInvoice account with a trusted authenticator app.
        </p>
      </section>
    </main>
  )
}
