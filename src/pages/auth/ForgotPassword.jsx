import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Mail, MailCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import authService from '../../services/authService'
import useToastStore from '../../stores/useToastStore'
import { developmentAuthPath } from '../../utils/developmentAuthLink'
import { getErrorMessage } from '../../utils/httpError'
import { firstError, validateForgotPasswordForm } from '../../utils/validation'
import styles from './Recovery.module.css'

/** Concept A: presentation redesigned; original reset-link API and redirect behaviour preserved. */
export default function ForgotPassword() {
  const showToast = useToastStore((state) => state.showToast)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [requested, setRequested] = useState(false)

  const updateEmail = (event) => {
    const value = event.target.value
    setEmail(value)
    setErrors(submitted ? validateForgotPasswordForm(value) : {})
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    const nextErrors = validateForgotPasswordForm(email)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      showToast(firstError(nextErrors), 'warning', 'Check your email')
      return
    }

    setLoading(true)
    try {
      const response = await authService.forgotPassword(email)
      const url = developmentAuthPath(response.data?.data?.development_reset_url, '/reset-password')
      showToast('Check your inbox for the password reset link.', 'success', 'Reset link requested')
      if (url) {
        // Development-only shortcut retained from the previous frontend.
        navigate(url)
      } else {
        setRequested(true)
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to submit password reset request.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.page} fx-stagger`}>
      {requested ? (
        <section className={styles.confirmation} role="status" aria-live="polite">
          <span className={styles.confirmationIcon} aria-hidden="true"><MailCheck size={24} /></span>
          <p className={styles.eyebrow}>Request received</p>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.lead}>
            If an account exists for <strong className={styles.email}>{email}</strong>, a secure reset link has been sent. The link expires in 30 minutes.
          </p>
          <Button variant="secondary" size="lg" block onClick={() => { setRequested(false); setSubmitted(false); setErrors({}) }} className={styles.submit}>
            Request another link
          </Button>
          <Link to="/login" className={styles.returnLink}><ArrowLeft size={16} aria-hidden="true" /> Return to sign in</Link>
        </section>
      ) : (
        <>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Account recovery</p>
            <h1 className={styles.title}>Reset your password</h1>
            <p className={styles.lead}>Provide your sign-in email address and we will email you a secure reset link.</p>
          </header>
          <form className={styles.form} onSubmit={submit} noValidate>
            <TextField
              id="forgot-email" name="email" type="email" icon={Mail} autoComplete="email"
              label="Email address" placeholder="you@business.com" value={email}
              onChange={updateEmail} error={errors.email} required
            />
            <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
              Email reset link
            </Button>
          </form>
          <Link to="/login" className={styles.returnLink}><ArrowLeft size={16} aria-hidden="true" /> Return to sign in</Link>
        </>
      )}
    </div>
  )
}
