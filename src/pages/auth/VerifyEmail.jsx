import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react'
import Button from '../../components/ui/Button'
import authService from '../../services/authService'
import useAuthStore from '../../stores/useAuthStore'
import { getErrorMessage } from '../../utils/httpError'
import { APP_PATHS } from '../../utils/appPaths'
import styles from './Verification.module.css'

/** Public verification route: email proof must never substitute for MFA sign-in. */
export default function VerifyEmail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const applyPayload = useAuthStore((state) => state.applyPayload)
  const clearSession = useAuthStore((state) => state.clearSession)
  const verificationStarted = useRef(false)
  const [result, setResult] = useState({ status: 'loading', message: 'Verifying your email address...' })

  useEffect(() => {
    if (verificationStarted.current) return
    verificationStarted.current = true

    const run = async () => {
      if (!token) {
        setResult({ status: 'error', message: 'The verification link is missing its security token.' })
        return
      }
      try {
        const response = await authService.verifyEmail(token)
        const payload = response.data?.data || {}
        if (payload.mfa_sign_in_required) {
          // The server revokes the current refresh session and clears cookies.
          // Do not apply an anonymous MFA response as an authenticated session.
          clearSession()
          setResult({
            status: 'success',
            loginRequired: true,
            message: 'Your email is verified. Sign in again with your authenticator code.',
          })
          return
        }

        applyPayload(payload)
        const enrolmentRequired = Boolean(payload.mfa_policy?.enrolment_required)
        setResult({
          status: 'success',
          message: 'Your email is verified. Select a plan to activate your workspace.',
          nextPath: enrolmentRequired ? APP_PATHS.mfaEnrollment : APP_PATHS.plans,
          enrolmentRequired,
        })
      } catch (error) {
        setResult({ status: 'error', message: getErrorMessage(error, 'Email verification failed.') })
      }
    }
    run()
  }, [applyPayload, clearSession, token])

  const isLoading = result.status === 'loading'
  const isSuccess = result.status === 'success'
  const Icon = isLoading ? LoaderCircle : isSuccess ? CheckCircle2 : TriangleAlert

  return (
    <section className={`${styles.page} fx-stagger`} aria-labelledby="verify-email-title" aria-live="polite" aria-atomic="true">
      <span className={`${styles.statusIcon} ${isLoading ? styles.loadingIcon : isSuccess ? styles.successIcon : styles.errorIcon}`} aria-hidden="true">
        <Icon size={26} strokeWidth={1.9} className={isLoading ? styles.spinner : undefined} />
      </span>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>
          {isLoading ? 'Checking your email' : isSuccess ? 'Verification complete' : 'Unable to verify'}
        </p>
        <h1 className={styles.title} id="verify-email-title">Email verification</h1>
        <p className={styles.lead}>{result.message}</p>
      </header>
      {isLoading ? (
        <p className={styles.note}><ShieldCheck size={15} aria-hidden="true" /> Verifying your business email address...</p>
      ) : isSuccess ? (
        <>
          <Button
            size="lg" block iconRight={ArrowRight}
            onClick={() => navigate(result.loginRequired ? APP_PATHS.login : result.nextPath, { replace: true })}
            className={styles.action}
          >
            {result.loginRequired ? 'Sign in securely' : result.enrolmentRequired ? 'Set up secure sign-in' : 'View subscription plans'}
          </Button>
          <p className={styles.note}>
            <ShieldCheck size={15} aria-hidden="true" />
            {result.loginRequired
              ? 'Your business email is confirmed. Complete sign-in to continue.'
              : 'Your business email is confirmed.'}
          </p>
        </>
      ) : (
        <Link className={styles.returnLink} to="/login">
          <ArrowLeft size={16} aria-hidden="true" /> Return to sign in
        </Link>
      )}
    </section>
  )
}
