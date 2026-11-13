import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, Download, KeyRound, RotateCcw, ShieldAlert, ShieldCheck, Smartphone, X } from 'lucide-react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import PageLoader from '../ui/PageLoader'
import TextField from '../forms/TextField'
import PasswordField from '../forms/PasswordField'
import Checkbox from '../forms/Checkbox'
import MfaCodeInput from './MfaCodeInput'
import { completeMfaCode, emptyMfaDigits } from './mfaCodeUtils'
import mfaService from '../../services/mfaService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import styles from './MfaSecurityCard.module.css'

const readStatus = (response) => {
  const data = response?.data?.data
  if (!data || typeof data.enabled !== 'boolean' || typeof data.has_password !== 'boolean') {
    throw new Error('Account security status is incomplete. Please try again.')
  }
  return data
}

async function copyText(value) {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available.')
  await navigator.clipboard.writeText(value)
}

function saveRecoveryCodes(codes) {
  const blob = new Blob([`DigitalInvoice MFA recovery codes\n${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'digitalinvoice-mfa-recovery-codes.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function MfaSecurityCard({ hasPassword = false }) {
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)
  const sessionPolicyRequired = useAuthStore((state) => Boolean(state.mfaPolicy?.required))
  const toast = useToastStore((state) => state.showToast)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [action, setAction] = useState('') // '' | 'regenerate' | 'disable'
  const [setup, setSetup] = useState(null)
  const [digits, setDigits] = useState(emptyMfaDigits)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [mustSignIn, setMustSignIn] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStatus(readStatus(await mfaService.status()))
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to load authenticator settings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!setup || recoveryCodes.length) return undefined
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((setup.expiresAt - Date.now()) / 1000)))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [setup, recoveryCodes.length])

  // The confirmation endpoint revokes the cookie. Keep one-time codes on screen
  // until the user acknowledges them; warn before accidental reload/navigation.
  useEffect(() => {
    if (!recoveryCodes.length) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [recoveryCodes.length])

  const startSetup = async (event) => {
    event.preventDefault()
    if (busy || !password || status?.setup_readiness?.ready === false) {
      if (!password) setError('Enter your current password to start authenticator setup.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = (await mfaService.setup(password))?.data?.data
      if (!data?.secret || !data?.otpauth_uri?.startsWith('otpauth://totp/')) {
        throw new Error('Authenticator setup details were not returned. Try again.')
      }
      setSetup({ secret: data.secret, uri: data.otpauth_uri, expiresAt: Date.now() + (Number(data.expires_in_seconds) || 600) * 1000 })
      setPassword('')
      setDigits(emptyMfaDigits())
      setKeyCopied(false)
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to start authenticator setup.'))
    } finally {
      setBusy(false)
    }
  }

  const confirmSetup = async (event) => {
    event.preventDefault()
    const code = completeMfaCode(digits)
    if (!code) { setError('Enter all six digits from your authenticator app.'); return }
    if (!secondsLeft) { setError('Enrollment expired. Start setup again.'); return }
    setBusy(true)
    setError('')
    try {
      const data = (await mfaService.confirm(code))?.data?.data || {}
      if (!data.signed_out || !Array.isArray(data.recovery_codes) || !data.recovery_codes.length) {
        clearSession()
        toast('Account security changed. Sign in again to review your MFA status.', 'warning', 'Sign-in required')
        navigate('/login', { replace: true })
        return
      }
      setRecoveryCodes(data.recovery_codes)
      setMustSignIn(true)
      setSetup(null)
      setDigits(emptyMfaDigits())
      setStatus((current) => ({ ...current, enabled: true }))
      toast('MFA enabled. Save your one-time recovery codes.', 'success', 'Authenticator enabled')
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to confirm authenticator setup.'))
    } finally {
      setBusy(false)
    }
  }

  const manageMfa = async (event) => {
    event.preventDefault()
    if (busy || !action) return
    if (!password || !otp.trim()) { setError('Enter your current password and authenticator or recovery code.'); return }
    if (action === 'disable' && (status?.policy?.required || sessionPolicyRequired)) {
      setError('Authenticator MFA is required for your role and cannot be disabled.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = action === 'disable'
        ? await mfaService.disable(password, otp.trim())
        : await mfaService.regenerate(password, otp.trim())
      const data = response?.data?.data || {}
      setPassword('')
      setOtp('')
      setAction('')
      if (action === 'disable') {
        // PHP revokes every token and clears cookies after disabling MFA.
        clearSession()
        toast('Authenticator disabled. Sign in again.', 'success', 'Security updated')
        navigate('/login', { replace: true })
      } else {
        if (!Array.isArray(data.recovery_codes) || !data.recovery_codes.length) {
          throw new Error('New recovery codes were not returned. Contact support before retrying.')
        }
        setRecoveryCodes(data.recovery_codes)
        setMustSignIn(false)
        setStatus((current) => ({ ...current, recovery_codes_remaining: data.recovery_codes.length }))
        toast('Previous recovery codes have been invalidated.', 'success', 'Codes regenerated')
      }
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to update authenticator settings.'))
    } finally {
      setBusy(false)
    }
  }

  const finishCodes = () => {
    if (!acknowledged) return
    setRecoveryCodes([])
    setCopied(false)
    setAcknowledged(false)
    if (mustSignIn) {
      clearSession()
      navigate('/login', { replace: true })
    } else {
      setMustSignIn(false)
      load()
    }
  }

  const handleCopy = async (value, success, setter) => {
    try {
      await copyText(value)
      setter(true)
      toast(success, 'success', 'Copied')
    } catch {
      setError('Clipboard unavailable. Select the text and copy it manually, or save your recovery codes to a file.')
    }
  }

  const mandatory = Boolean(status?.policy?.required || sessionPolicyRequired)
  const passwordReady = Boolean(status?.has_password && hasPassword)
  const setupUnavailable = status?.setup_readiness?.ready === false

  if (loading && !status) return <PageLoader inline message="Loading MFA settings…" />
  if (!status) return <div className={styles.stack}><Alert tone="danger" title="Security settings unavailable">{error || 'Unable to load authenticator settings.'}</Alert><Button variant="secondary" icon={RotateCcw} onClick={load}>Try again</Button></div>

  return (
    <div className={styles.stack} aria-busy={busy || undefined}>
      {mandatory ? <Alert tone="info" title="Required for your role">Authenticator MFA cannot be disabled on this account.</Alert> : null}
      {error ? <Alert tone="danger" title="Security update unsuccessful" onDismiss={() => setError('')}>{error}</Alert> : null}
      {recoveryCodes.length ? (
        <section className={styles.stack} aria-label="One-time recovery codes" data-mfa-recovery-codes="true">
          <Alert tone="warning" title="Save these codes now">
            These codes are shown only once. Each code can be used for one sign-in. Keep them in a secure password manager, not in a shared document.
            {mustSignIn ? ' Your sessions have been signed out; sign in again after saving them.' : ''}
          </Alert>
          <div className={styles.codes}>
            {recoveryCodes.map((code, index) => <code className={styles.code} key={`${index}-${code}`}><span>{index + 1}.</span>{code}</code>)}
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" icon={Copy} onClick={() => handleCopy(recoveryCodes.join('\n'), 'Recovery codes copied.', setCopied)}>{copied ? 'Codes copied' : 'Copy all codes'}</Button>
            <Button variant="secondary" icon={Download} onClick={() => saveRecoveryCodes(recoveryCodes)}>Save to a file</Button>
          </div>
          <Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} label="I have saved my recovery codes somewhere safe." />
          <div className={styles.actions}><Button disabled={!acknowledged} onClick={finishCodes}>{mustSignIn ? "I've saved my codes — sign in again" : "I've saved my codes — close"}</Button></div>
        </section>
      ) : status.enabled ? (
        <div className={styles.stack}>
          <div className={styles.statusLine}><CheckCircle2 size={19} aria-hidden="true" /><strong>Authenticator enabled</strong><span className="num">{status.recovery_codes_remaining ?? '—'} unused recovery codes</span></div>
          <p className={styles.note}>To manage your authenticator, enter your account password and a valid authenticator or one-time recovery code. Used recovery codes cannot be reused.</p>
          {!passwordReady ? <Alert tone="warning">Create an account password above before managing MFA.</Alert> : (
            <>
              <div className={styles.actions}>
                <Button icon={KeyRound} variant="secondary" onClick={() => { setAction('regenerate'); setPassword(''); setOtp(''); setError('') }} disabled={busy}>Regenerate recovery codes</Button>
                {!mandatory ? <Button variant="danger" onClick={() => { setAction('disable'); setPassword(''); setOtp(''); setError('') }} disabled={busy}>Disable MFA</Button> : null}
                <Button icon={RotateCcw} variant="ghost" onClick={load} disabled={busy}>Refresh status</Button>
              </div>
              {action ? (
                <form className={styles.form} onSubmit={manageMfa} noValidate>
                  <div className={styles.actionHeader}><h3>{action === 'disable' ? 'Disable authenticator MFA?' : 'Replace your recovery codes?'}</h3><Button variant="ghost" icon={X} size="sm" onClick={() => { setAction(''); setError(''); setPassword(''); setOtp('') }}>Cancel</Button></div>
                  <Alert tone={action === 'disable' ? 'warning' : 'info'}>
                    {action === 'disable' ? 'This removes your authenticator and revokes every session. You must sign in again.' : 'All existing recovery codes will stop working immediately. The replacements are shown only once.'}
                  </Alert>
                  <PasswordField label="Current password" id="mfa-manage-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={busy} required />
                  <TextField label="Authenticator or recovery code" id="mfa-manage-code" value={otp} onChange={(event) => setOtp(event.target.value)} autoComplete="one-time-code" disabled={busy} required />
                  <Button variant={action === 'disable' ? 'danger' : 'primary'} loading={busy} type="submit">{action === 'disable' ? 'Disable MFA and sign out' : 'Regenerate codes'}</Button>
                </form>
              ) : null}
            </>
          )}
        </div>
      ) : setup ? (
        <form className={styles.stack} onSubmit={confirmSetup} noValidate>
          <div className={styles.setupIntro}><Smartphone size={20} aria-hidden="true" /><div><h3>Connect your authenticator app</h3><p>Scan this QR code in Google Authenticator, Microsoft Authenticator, 1Password or another TOTP-compatible app.</p></div></div>
          <div className={styles.qrPanel}>
            <div className={styles.qrCanvas} role="img" aria-label="Authenticator setup QR code"><QRCodeSVG value={setup.uri} size={208} level="M" includeMargin bgColor="#ffffff" fgColor="#111827" /></div>
            <p>Open your authenticator app, choose <strong>Add account</strong>, then <strong>Scan QR code</strong>.</p>
            <p>Can't scan? Enter this setup key manually (shown only during enrolment):</p>
            <div className={styles.keyBox}><code>{setup.secret}</code><button className={styles.copyButton} type="button" aria-label="Copy authenticator setup key" title="Copy setup key" onClick={() => handleCopy(setup.secret, 'Authenticator setup key copied.', setKeyCopied)}><Copy size={18} aria-hidden="true" /></button></div>
            {keyCopied ? <span className={styles.miniNote}>Setup key copied</span> : null}
            <p className={styles.miniNote}>The setup key expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}. Never share it with anyone.</p>
          </div>
          {secondsLeft > 0 ? <MfaCodeInput digits={digits} onChange={setDigits} disabled={busy} error="" /> : <Alert tone="warning">The setup key expired. Start a new setup to continue.</Alert>}
          <div className={styles.actions}>
            <Button type="submit" loading={busy} disabled={!secondsLeft || !completeMfaCode(digits)}>Confirm and enable MFA</Button>
            <Button variant="secondary" onClick={() => { setSetup(null); setDigits(emptyMfaDigits()); setError('') }}>Start setup again</Button>
          </div>
        </form>
      ) : !passwordReady ? (
        <Alert tone="warning" title="Account password required">Create a password in the section above, then sign in again to enable authenticator MFA.</Alert>
      ) : (
        <form className={styles.form} onSubmit={startSetup} noValidate>
          <div className={styles.statusLine} data-inactive="true"><ShieldAlert size={19} aria-hidden="true" /><strong>Authenticator not enabled</strong></div>
          <p className={styles.note}>Protect your account using an authenticator app. Setup requires your current account password and a six-digit code from the app.</p>
          {setupUnavailable ? <Alert tone="danger" title="Setup unavailable">{status.setup_readiness?.message || 'MFA setup is not available on the server.'} Contact your administrator; retrying your password will not resolve this configuration issue.</Alert> : null}
          <PasswordField id="mfa-setup-password" label="Current password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy || setupUnavailable} autoComplete="current-password" required />
          <div className={styles.actions}><Button type="submit" icon={ShieldCheck} loading={busy} disabled={setupUnavailable}>Set up authenticator</Button><Button variant="secondary" icon={RotateCcw} onClick={load} disabled={busy}>Refresh status</Button></div>
        </form>
      )}
    </div>
  )
}
