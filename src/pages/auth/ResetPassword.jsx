import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import PasswordField from '../../components/forms/PasswordField'
import PasswordStrength from '../../components/forms/PasswordStrength'
import authService from '../../services/authService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { firstError, validateResetPasswordForm } from '../../utils/validation'
import styles from './Recovery.module.css'

/** Concept A: original token validation, reset API and successful-login redirect preserved. */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const showToast = useToastStore((state) => state.showToast)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [invalidLink, setInvalidLink] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setInvalidLink(false)
    setRequestError('')
    setForm({ password: '', password_confirmation: '' })
    setErrors({})
    setSubmitted(false)
  }, [token])

  const update = (event) => {
    const { name, value } = event.target
    const nextForm = { ...form, [name]: value }
    setForm(nextForm)
    // Display validation on submit, then keep it up to date as fields are fixed.
    if (submitted) setErrors(validateResetPasswordForm(nextForm, token))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading || invalidLink || !token) return
    const nextErrors = validateResetPasswordForm(form, token)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      showToast(firstError(nextErrors), 'warning', 'Review your password')
      return
    }

    setRequestError('')
    setLoading(true)
    try {
      await authService.resetPassword({ token, ...form })
      // The backend revokes existing refresh sessions and clears auth cookies.
      // Do not let PublicRoute redirect an old local session back to the app.
      clearSession()
      showToast('Sign in using your new password.', 'success', 'Password changed')
      navigate('/login', { replace: true })
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to reset password.')
      setRequestError(message)
      if (error?.response?.status === 400) setInvalidLink(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.page} fx-stagger`}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Create new password</p>
        <h1 className={styles.title}>Choose a secure password</h1>
        <p className={styles.lead}>Use a strong password to protect your invoicing workspace and business records.</p>
      </header>

      {!token || invalidLink ? (
        <Alert tone="warning" title={invalidLink ? 'Reset link unavailable' : 'Reset link required'} className={styles.tokenNotice}>
          {invalidLink ? requestError : 'This link is missing its reset token.'}
          {' '}<Link to="/forgot-password">Request a new reset link</Link> to continue.
        </Alert>
      ) : requestError ? (
        <Alert tone="danger" title="Unable to reset password" className={styles.tokenNotice}>
          {requestError}
        </Alert>
      ) : null}

      {token && !invalidLink ? <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.passwordRow}>
          <PasswordField
            id="reset-password" name="password" autoComplete="new-password"
            label="New password" placeholder="Enter password" value={form.password}
            onChange={update} error={errors.password} required
          />
          <PasswordField
            id="reset-confirm" name="password_confirmation" autoComplete="new-password"
            label="Confirm password" placeholder="Confirm password" value={form.password_confirmation}
            onChange={update} error={errors.password_confirmation} required
          />
        </div>
        <PasswordStrength value={form.password} />
        <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
          Save new password
        </Button>
      </form> : null}
      <Link to="/login" className={styles.returnLink}><ArrowLeft size={16} aria-hidden="true" /> Return to sign in</Link>
    </div>
  )
}
