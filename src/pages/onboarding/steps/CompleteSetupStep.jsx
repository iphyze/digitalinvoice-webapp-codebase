import { ArrowRight, ChevronRight, CircleAlert, CircleCheck, Info, Rocket, TriangleAlert } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { StepHeader } from './StepParts'
import styles from '../Onboarding.module.css'

const REQUIRED_STEPS = [
  { key: 'business_profile', label: 'Business profile' },
  { key: 'invoice_settings', label: 'Invoice settings' },
  { key: 'compliance_profile', label: 'Compliance profile' },
]

/** Final review. Copy and rules carried over from the previous app. */
export default function CompleteSetupStep({ onboarding, accounts = [], completing, onComplete, onGoToStep }) {
  const missing = REQUIRED_STEPS.filter(({ key }) => !onboarding?.steps?.[key]?.completed)
  const ready = missing.length === 0
  return (
    <div>
      <StepHeader icon={Rocket} eyebrow="Final review" title="Start using DigitalInvoice"
        description="Confirm the core configuration below and open your workspace." />
      <div className={styles.review}>
        {REQUIRED_STEPS.map(({ key, label }) => {
          const done = onboarding?.steps?.[key]?.completed
          return (
            <button key={key} type="button" className={styles.reviewItem} data-state={done ? 'ready' : 'missing'} onClick={() => onGoToStep(key)}>
              <span className={styles.reviewIcon}>{done ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}</span>
              <span className={styles.reviewText}><strong>{label}</strong><small>{done ? 'Completed' : 'Still required'}</small></span>
              <ChevronRight size={18} className={styles.reviewChevron} aria-hidden="true" />
            </button>
          )
        })}
        <div className={styles.reviewItem} data-state={accounts.length ? 'ready' : 'optional'}>
          <span className={styles.reviewIcon}>{accounts.length ? <CircleCheck size={20} aria-hidden="true" /> : <Info size={20} aria-hidden="true" />}</span>
          <span className={styles.reviewText}>
            <strong>Payment account</strong>
            <small>{accounts.length ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} configured` : 'Optional — add later in settings'}</small>
          </span>
        </div>
      </div>

      {!ready ? (
        <p className={styles.finishWarning} role="status">
          <TriangleAlert size={17} aria-hidden="true" />
          Complete {missing.map(({ label }) => label.toLowerCase()).join(', ')} before opening your workspace.
        </p>
      ) : null}

      <div className={styles.finish} data-ready={ready || undefined}>
        <div>
          <strong>{ready ? 'Everything is ready' : 'Setup is not yet complete'}</strong>
          <p>{ready ? 'Your dashboard, customer records and invoicing workspace will become available immediately.' : 'Use the checklist to complete all mandatory business information.'}</p>
        </div>
        <Button size="lg" disabled={!ready} loading={completing} onClick={onComplete} iconRight={ArrowRight}>Complete setup</Button>
      </div>
    </div>
  )
}
