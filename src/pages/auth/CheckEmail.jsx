import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock3, MailCheck, Send } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import authService from '../../services/authService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { developmentAuthPath } from '../../utils/developmentAuthLink'
import { getErrorMessage } from '../../utils/httpError'
import styles from './Verification.module.css'

/** The resend API requires an authenticated, email-unverified session. */
export default function CheckEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const emailFromLink = params.get('email')
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const nextPath = useAuthStore((state) => state.nextPath)
  const showToast = useToastStore((state) => state.showToast)
  const [loading, setLoading] = useState(false)
  const [resendError, setResendError] = useState('')
  const [alreadyVerified, setAlreadyVerified] = useState(false)

  const checking = status === 'checking'
  const signedIn = status === 'authenticated' && Boolean(user)
  const verified = alreadyVerified || Boolean(user?.email_verified_at)
  const email = user?.email || emailFromLink || 'your registered email address'

  const resendEmail = async () => {
    if (loading || checking || !signedIn || verified) return
    setResendError('')
    setLoading(true)
    try {
      const response = await authService.resendVerification()
      if (response.data?.message === 'Your email address is already verified.') {
        setAlreadyVerified(true)
        showToast('Your email address is already verified.', 'info', 'Already verified')
        return
      }
      showToast('A fresh verification link has been sent to your inbox.', 'success', 'Email resent')
      const url = developmentAuthPath(response.data?.data?.development_verification_url, '/verify-email')
      if (url) navigate(url)
    } catch (error) {
      if (error?.response?.status === 401) {
        clearSession()
        setResendError('Your session has ended. Sign in again to resend your verification email.')
      } else {
        setResendError(getErrorMessage(error, 'Unable to resend your verification email.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={`${styles.page} fx-stagger`} aria-labelledby="check-email-title">
      <span className={`${styles.statusIcon} ${styles.infoIcon}`} aria-hidden="true">
        <MailCheck size={26} strokeWidth={1.8} />
      </span>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Confirm your email</p>
        <h1 className={styles.title} id="check-email-title">Check your inbox</h1>
        <p className={styles.lead}>
          We sent a verification link to <strong className={styles.address}>{email}</strong>.
          {' '}Open the email and verify your account to continue to subscription activation.
        </p>
      </header>

      {checking ? (
        <div className={styles.sessionState} role="status">
          <Spinner size={18} /> Checking your sign-in status…
        </div>
      ) : verified ? (
        <>
          <Alert tone="success" title="Email already verified">
            Your email address is verified. You can continue to your account.
          </Alert>
          <Button size="lg" block to={signedIn ? nextPath() : '/login'} className={styles.action}>
            {signedIn ? 'Continue to your account' : 'Sign in securely'}
          </Button>
        </>
      ) : !signedIn ? (
        <>
          <Alert tone="info" title="Sign in to resend">
            The resend action requires an active account session. Sign in to request a new verification link.
          </Alert>
          <Button size="lg" block to="/login" className={styles.action}>Sign in securely</Button>
        </>
      ) : (
        <>
          {resendError ? <Alert tone="warning" title="Email not sent">{resendError}</Alert> : null}
          <Button size="lg" block loading={loading} iconRight={Send} onClick={resendEmail} className={styles.action}>
            Resend verification email
          </Button>
        </>
      )}
      <Link className={styles.returnLink} to="/login">
        <ArrowLeft size={16} aria-hidden="true" /> Return to sign in
      </Link>
      <p className={styles.note}><Clock3 size={15} aria-hidden="true" /> Verification links expire after 24 hours.</p>
    </section>
  )
}
