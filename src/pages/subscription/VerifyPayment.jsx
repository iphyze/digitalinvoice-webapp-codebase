import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react'
import Button from '../../components/ui/Button'
import PageLoader from '../../components/ui/PageLoader'
import subscriptionService from '../../services/subscriptionService'
import useAuthStore from '../../stores/useAuthStore'
import { getErrorMessage } from '../../utils/httpError'
import SubscriptionHeader from './SubscriptionHeader'
import styles from './Plans.module.css'

/*
  Paystack return page (/subscription/verify), in the Plans page's style.
  Behaviour and copy from the previous app: verify the reference once,
  refresh the session, then "Continue setup" or "Return to plans".
*/
export default function VerifyPayment() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const refreshSessionState = useAuthStore((s) => s.refreshSessionState)
  const nextPath = useAuthStore((s) => s.nextPath)
  const started = useRef(false)
  const [result, setResult] = useState({ state: 'loading', message: 'Confirming your subscription payment...' })

  const reference = params.get('reference') || params.get('trxref')
  const checkPayment = useCallback(async () => {
    if (!reference) {
      setResult({ state: 'error', message: 'Payment reference was not provided.' })
      return
    }
    setResult({ state: 'loading', message: 'Confirming your subscription payment...' })
    try {
      const response = await subscriptionService.verify(reference)
      await refreshSessionState()
      setResult({ state: 'success', message: response?.data?.message || 'Payment verified. Your subscription is active and setup can begin.' })
    } catch (error) {
      const isGatewayUnavailable = error?.response?.status === 502
      setResult({
        state: 'error',
        message: isGatewayUnavailable
          ? "We couldn't reach the payment provider. Your payment is safe; try again in a moment."
          : getErrorMessage(error, 'Payment verification was unsuccessful.'),
        errorId: error?.response?.data?.error_id || null,
      })
    }
  }, [reference, refreshSessionState])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void checkPayment()
  }, [checkPayment])

  if (result.state === 'loading') return <PageLoader message="Confirming your secure Paystack subscription..." />

  const success = result.state === 'success'
  return (
    <div className={styles.page}>
      <SubscriptionHeader />
      <main id="main-content" className={styles.resultWrap}>
        <section className={`${styles.band} ${styles.resultBand}`} aria-hidden="true">
          <span className={styles.glowA} />
          <span className={styles.glowB} />
        </section>
        <section className={`${styles.resultCard} fx-enter`} data-state={result.state} aria-live="polite">
          <span className={styles.resultIcon}>
            {success ? <CircleCheck size={30} aria-hidden="true" /> : <TriangleAlert size={30} aria-hidden="true" />}
          </span>
          <p className={styles.resultEyebrow}>{success ? 'Payment confirmed' : 'Payment not confirmed'}</p>
          <h1 className={styles.resultTitle}>Subscription payment</h1>
          <p className={styles.resultMessage}>{result.message}</p>
          {result.errorId ? <p className={styles.resultErrorId}>Error ID: <code>{result.errorId}</code></p> : null}
          {success ? (
            <Button size="lg" iconRight={ArrowRight} onClick={() => navigate(nextPath(), { replace: true })}>Continue setup</Button>
          ) : (
            <div className={styles.resultActions}>
              <Button size="lg" icon={RefreshCw} onClick={checkPayment} disabled={!reference}>Check again</Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/subscription/plans')}>Return to plans</Button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
