import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Check, CircleCheck, FileText, Landmark, Lock, ShieldCheck } from 'lucide-react'
import Logo from '../../components/brand/Logo'
import PageLoader from '../../components/ui/PageLoader'
import Alert from '../../components/ui/Alert'
import SignOutAction from '../../components/auth/SignOutAction'
import ThemeToggle from '../../components/ui/ThemeToggle'
import onboardingService from '../../services/onboardingService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { nextOnboardingStep, hasSavedOnboardingProgress } from '../../utils/onboardingResume'
import BusinessProfileStep from './steps/BusinessProfileStep'
import InvoiceSettingsStep from './steps/InvoiceSettingsStep'
import ComplianceProfileStep from './steps/ComplianceProfileStep'
import BankAccountStep from './steps/BankAccountStep'
import CompleteSetupStep from './steps/CompleteSetupStep'
import styles from './Onboarding.module.css'

/*
  Workspace setup (approved Sample B: top stepper + centred card).
  Behaviour and copy carried over from the previous app: loads status, profile,
  invoice settings, compliance profile and bank accounts; opens the first
  remaining step; each step saves, refreshes the session and moves on;
  "Complete setup" opens the dashboard.
*/
const STEPS = [
  { key: 'business_profile', title: 'Business profile', description: 'Company and contact details', icon: Building2, required: true },
  { key: 'invoice_settings', title: 'Invoice settings', description: 'Tax and numbering defaults', icon: FileText, required: true },
  { key: 'compliance_profile', title: 'Compliance profile', description: 'Issuer and tax identity', icon: ShieldCheck, required: true },
  { key: 'bank_accounts', title: 'Payment account', description: 'Optional bank instructions', icon: Landmark, required: false },
  { key: 'finish', title: 'Complete setup', description: 'Review and enter workspace', icon: CircleCheck, required: false },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const organization = useAuthStore((s) => s.organization)
  const storedOnboarding = useAuthStore((s) => s.onboarding)
  const refreshSessionState = useAuthStore((s) => s.refreshSessionState)
  const showToast = useToastStore((s) => s.showToast)
  const [data, setData] = useState(() => ({ onboarding: storedOnboarding, profile: null, settings: null, complianceProfile: null, accounts: [] }))
  const [activeStep, setActiveStep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [stepBusy, setStepBusy] = useState(false)
  const [resumeDismissed, setResumeDismissed] = useState(false)
  const reportUnsavedChanges = useCallback((dirty) => setHasUnsavedChanges(dirty), [])
  const reportStepBusy = useCallback((busy) => setStepBusy(busy), [])

  const loadSetup = useCallback(async () => {
    setLoading(true)
    try {
      const [status, profile, settings, compliance, accounts] = await Promise.all([
        onboardingService.status(),
        onboardingService.getProfile(),
        onboardingService.getInvoiceSettings(),
        onboardingService.getComplianceProfile(),
        onboardingService.getBankAccounts(),
      ])
      const onboarding = status.data?.data?.onboarding || null
      setData({
        onboarding,
        profile: profile.data?.data?.profile || null,
        settings: settings.data?.data?.settings || null,
        complianceProfile: compliance.data?.data?.profile || null,
        accounts: accounts.data?.data?.bank_accounts || [],
      })
      setActiveStep(nextOnboardingStep(onboarding))
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to load setup information.'), 'error', 'Setup unavailable')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadSetup() }, [loadSetup])

  const completedRequired = useMemo(
    () => STEPS.filter((s) => s.required && data.onboarding?.steps?.[s.key]?.completed).length,
    [data.onboarding],
  )
  const progressPercent = Math.round((completedRequired / 3) * 100)
  const progressLabel = `Required steps: ${completedRequired} of 3 complete`

  const stepCompleted = (key) => {
    if (key === 'bank_accounts') return data.accounts.length > 0
    if (key === 'finish') return Boolean(data.onboarding?.can_access_workspace)
    return Boolean(data.onboarding?.steps?.[key]?.completed)
  }

  const goTo = (key) => {
    setHasUnsavedChanges(false)
    setActiveStep(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaved = async (key, responseData, nextStep) => {
    setData((current) => ({
      ...current,
      onboarding: responseData.onboarding || current.onboarding,
      ...(key === 'business_profile' ? { profile: responseData.profile } : {}),
      ...(key === 'invoice_settings' ? { settings: responseData.settings } : {}),
      ...(key === 'compliance_profile' ? { complianceProfile: responseData.profile } : {}),
    }))
    try {
      const session = await refreshSessionState()
      if (session?.onboarding) setData((current) => ({ ...current, onboarding: session.onboarding }))
    } catch {
      // The save response already updated the page if the silent session refresh fails.
    }
    goTo(nextStep)
  }

  const completeSetup = async () => {
    setCompleting(true)
    try {
      await onboardingService.complete()
      await refreshSessionState()
      showToast('Your workspace is ready. Welcome to DigitalInvoice.', 'success', 'Setup complete')
      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to complete business setup.'), 'error', 'Setup not completed')
    } finally {
      setCompleting(false)
    }
  }

  const showResumeNotice = !resumeDismissed && !data.onboarding?.can_access_workspace
    && hasSavedOnboardingProgress(data.onboarding)

  const activeIndex = Math.max(0, STEPS.findIndex((s) => s.key === activeStep))

  return (
    <div className={styles.page}>
      <span className={styles.glowA} aria-hidden="true" />
      <span className={styles.glowB} aria-hidden="true" />
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink} aria-label="DigitalInvoice home"><Logo variant="full" height={38} alt="DigitalInvoice" /></Link>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <SignOutAction hasUnsavedChanges={hasUnsavedChanges} disabled={stepBusy || completing} />
        </div>
      </header>

      {loading ? <main id="main-content" className={styles.main}><PageLoader inline message="Preparing your DigitalInvoice workspace setup..." /></main> : (
        <main id="main-content" className={styles.main}>
        {showResumeNotice ? (
          <Alert tone="info" title="Welcome back" className={styles.resumeNotice} onDismiss={() => setResumeDismissed(true)}>
            Your progress has been saved; continue from where you stopped.
          </Alert>
        ) : null}
        <section className={`${styles.intro} fx-stagger`}>
          <p className={styles.eyebrow}>Workspace setup</p>
          <h1>Set up {organization?.name || 'your business'}</h1>
          <p className={styles.lead}>Complete the required business information once, then begin issuing and tracking invoices securely.</p>
        </section>

        {/* Mobile: compact step summary */}
        <div className={styles.mobileStep} aria-hidden="true">
          <div><span className="num">Step {activeIndex + 1} of 5</span><strong>{STEPS[activeIndex].title}</strong></div>
          <span className={`${styles.mobileProgress} num`}>{progressPercent}%</span>
        </div>
        <div className={styles.mobileBar} aria-hidden="true"><i style={{ width: `${progressPercent}%` }} /></div>

        <nav className={styles.tracker} aria-label="Workspace setup steps" style={{ '--progress': `${(activeIndex / (STEPS.length - 1)) * 100}%` }}>
          <span className={styles.trackLine} aria-hidden="true"><i /></span>
          {STEPS.map((step) => {
            const done = stepCompleted(step.key)
            const selected = activeStep === step.key
            const Icon = step.icon
            return (
              <button
                key={step.key}
                type="button"
                className={styles.trackStep}
                data-done={done || undefined}
                aria-current={selected ? 'step' : undefined}
                onClick={() => goTo(step.key)}
              >
                <span className={styles.trackIcon}>{done && !selected ? <Check size={18} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}</span>
                <strong>{step.title}</strong>
                <small>{step.key === 'bank_accounts' ? 'Optional' : step.description}</small>
                <span className="sr-only">{done ? '(completed)' : ''}</span>
              </button>
            )
          })}
        </nav>

        <section className={styles.card} aria-live="polite">
          <div key={activeStep} className={styles.stepBody}>
            {activeStep === 'business_profile' ? (
              <BusinessProfileStep profile={data.profile} organization={organization} completed={stepCompleted('business_profile')} onSaved={handleSaved} onDirtyChange={reportUnsavedChanges} onBusyChange={reportStepBusy} progressLabel={progressLabel} />
            ) : null}
            {activeStep === 'invoice_settings' ? (
              <InvoiceSettingsStep settings={data.settings} completed={stepCompleted('invoice_settings')} onSaved={handleSaved} onDirtyChange={reportUnsavedChanges} onBusyChange={reportStepBusy} onBack={() => goTo('business_profile')} progressLabel={progressLabel} />
            ) : null}
            {activeStep === 'compliance_profile' ? (
              <ComplianceProfileStep profile={data.complianceProfile} completed={stepCompleted('compliance_profile')} onSaved={handleSaved} onDirtyChange={reportUnsavedChanges} onBusyChange={reportStepBusy} onBack={() => goTo('invoice_settings')} progressLabel={progressLabel} />
            ) : null}
            {activeStep === 'bank_accounts' ? (
              <BankAccountStep accounts={data.accounts} onDirtyChange={reportUnsavedChanges} onBusyChange={reportStepBusy} onAccountsChanged={(accounts) => setData((c) => ({ ...c, accounts }))}
                onBack={() => goTo('compliance_profile')} onContinue={() => goTo('finish')} progressLabel={progressLabel} />
            ) : null}
            {activeStep === 'finish' ? (
              <CompleteSetupStep onboarding={data.onboarding} accounts={data.accounts} completing={completing} onComplete={completeSetup} onGoToStep={goTo} />
            ) : null}
          </div>
        </section>

        <p className={styles.security}>
          <Lock size={15} aria-hidden="true" />
          Your business details are stored securely and are used to prepare accurate invoice records.
        </p>
      </main>
      )}
    </div>
  )
}
