import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CircleCheck, CreditCard, FileText, Layers, LayoutGrid, Percent, PhoneCall, ShieldCheck, Sparkles, Users, WandSparkles, PackageOpen } from 'lucide-react'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Skeleton from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import subscriptionService from '../../services/subscriptionService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { PLAN_FEATURES, limitDisplay } from '../../utils/entitlements'
import { capitalizeWords, formatCurrency, formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import PremiumRequestModal, { defaultPremiumForm } from './PremiumRequestModal'
import SubscriptionHeader from './SubscriptionHeader'
import {
  BILLING_INTERVALS, actualAmountKobo, buttonLabelForVariant, checkoutActionForVariant, currentPlanMatches,
  discountLabel, discountedAmountKobo, hasActiveAccess, hasDiscount, initialIntervals, intervalLabel,
  intervalMapForPlan, intervalShortLabel, normalizeStatus, shouldShowActualAmount, variantForPlan,
} from './planUtils'
import styles from './Plans.module.css'

/*
  Subscription plans (approved Sample B: navy band, plan cards overlapping it).
  Behaviour and copy carried over from the previous app: plans + status load,
  per-plan billing switch, discount display, button labels, Paystack checkout
  redirect, cancel renewal (confirm), Premium request (validation + defaults).
*/

function CurrentSubscription({ access, onCancel, cancelling, canManageSubscription }) {
  const subscription = access?.subscription
  if (!subscription) return null
  const status = normalizeStatus(subscription.status)
  const isActive = hasActiveAccess(access)
  const isNonRenewing = status === 'non_renewing'
  const canCancel = canManageSubscription && isActive && !isNonRenewing
  const periodEnd = subscription.current_period_end ? formatDate(subscription.current_period_end) : 'Not available'
  const amount = Number(subscription.amount_kobo || 0) / 100
  return (
    <section className={styles.current} aria-label="Current subscription">
      <div className={styles.currentMain}>
        <span className={styles.currentIcon}><ShieldCheck size={22} aria-hidden="true" /></span>
        <div>
          <p className={styles.currentEyebrow}>Current subscription</p>
          <h2 className={styles.currentName}>{subscription.plan_name || 'DigitalInvoice plan'}</h2>
          <p className={`${styles.currentMeta} num`}>
            {capitalizeWords(subscription.billing_interval || 'monthly')} billing · {formatCurrency(amount, subscription.currency || 'NGN')}
            {subscription.current_period_end ? ` · Ends ${periodEnd}` : ''}
          </p>
        </div>
      </div>
      <div className={styles.currentSide}>
        <StatusBadge status={status} />
        {isNonRenewing ? <small>Renewal is cancelled. Access remains open until {periodEnd}.</small> : null}
        {!isActive ? <small>Renew or choose a new plan to restore workspace access.</small> : null}
        {canCancel ? <Button variant="secondary" size="sm" onClick={onCancel} loading={cancelling}>Cancel renewal</Button> : null}
      </div>
    </section>
  )
}

function PlanCard({ plan, index, selectedInterval, onInterval, subscription, access, canManageSubscription, checkingOut, onCheckout, onPremium }) {
  const intervalMap = intervalMapForPlan(plan)
  const variant = variantForPlan(plan, selectedInterval)
  const isContactPlan = Boolean(plan.is_contact_plan)
  const availableIntervals = BILLING_INTERVALS.filter((o) => intervalMap[o.value])
  const moduleCount = PLAN_FEATURES.filter((f) => plan.entitlements?.features?.[f.key]).length
  const isCurrent = currentPlanMatches(subscription, variant)
  const isPopular = !isCurrent && plan.tier === 'professional'
  const currency = variant?.currency || plan.currency || 'NGN'
  return (
    <article
      className={styles.plan}
      data-premium={isContactPlan || undefined}
      data-current={isCurrent || undefined}
      data-popular={isPopular || undefined}
      style={{ '--i': index }}
    >
      <div className={styles.planTop}>
        <span className={styles.planIcon}>
          {isContactPlan ? <WandSparkles size={20} aria-hidden="true" /> : <CreditCard size={20} aria-hidden="true" />}
        </span>
        {isCurrent ? <span className={`${styles.pill} ${styles.pillCurrent}`}>Current</span> : null}
        {isPopular ? <span className={`${styles.pill} ${styles.pillPopular}`}><Sparkles size={13} aria-hidden="true" />Popular</span> : null}
        {isContactPlan ? <span className={`${styles.pill} ${styles.pillPremium}`}>Custom</span> : null}
      </div>

      <h3 className={styles.planName}>{plan.name}</h3>
      <p className={styles.planDesc}>{plan.description || 'Digital invoicing workspace subscription.'}</p>

      {isContactPlan ? (
        <div className={styles.priceCustom}><strong>Custom</strong><span>Contact us</span></div>
      ) : (
        <>
          <div className={styles.billing} role="group" aria-label={`${plan.name} billing period`}>
            {BILLING_INTERVALS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={selectedInterval === option.value}
                disabled={!intervalMap[option.value]}
                onClick={() => onInterval(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className={styles.price} key={variant?.code || selectedInterval}>
            <strong className="num">{formatCurrency(discountedAmountKobo(variant) / 100, currency)}</strong>
            <span>/{intervalShortLabel(variant?.billing_interval || selectedInterval)}</span>
          </div>
          <div className={styles.discountRow}>
            {shouldShowActualAmount(variant) ? (
              <span className={`${styles.was} num`}>{formatCurrency(actualAmountKobo(variant) / 100, currency)}</span>
            ) : null}
            {hasDiscount(variant) ? (
              <span className={styles.save}>
                <Percent size={12} aria-hidden="true" />
                Save {discountLabel(variant)} on {intervalLabel(variant?.billing_interval).toLowerCase()} billing
              </span>
            ) : null}
          </div>
        </>
      )}

      {isContactPlan ? (
        <p className={styles.customNote}>
          <PhoneCall size={16} aria-hidden="true" />
          No fixed cost. Our team will review your workflow, users, integrations and compliance needs, then prepare a tailored package.
        </p>
      ) : null}

      <ul className={styles.features}>
        {(plan.features || ['Invoice management', 'Payment tracking', 'Reports']).map((feature) => (
          <li key={feature}><CircleCheck size={16} aria-hidden="true" />{feature}</li>
        ))}
      </ul>

      <div className={styles.entitlements}>
        <span><LayoutGrid size={14} aria-hidden="true" />{moduleCount} modules included</span>
        <span><FileText size={14} aria-hidden="true" />{limitDisplay(plan.entitlements?.limits?.invoices_per_month)} invoices/month</span>
        <span><Users size={14} aria-hidden="true" />{limitDisplay(plan.entitlements?.limits?.team_members)} users</span>
      </div>

      {isContactPlan ? (
        <Button onClick={onPremium} disabled={!canManageSubscription} size="lg" block iconRight={ArrowRight} className={styles.premiumCta}>
          {canManageSubscription ? 'Request Premium consultation' : 'Owner/admin only'}
        </Button>
      ) : (
        <Button
          size="lg"
          block
          variant={isCurrent ? 'secondary' : 'primary'}
          iconRight={ArrowRight}
          loading={checkingOut === variant?.code}
          disabled={!canManageSubscription || !variant?.available_for_checkout}
          onClick={() => onCheckout(variant)}
          className={styles.planCta}
        >
          {buttonLabelForVariant(access, subscription, variant, canManageSubscription)}
        </Button>
      )}
      {!isContactPlan && availableIntervals.length < 4 ? (
        <small className={styles.setupHint}>Some billing intervals are not configured yet.</small>
      ) : null}
    </article>
  )
}

function LoadingPlans() {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Loading plans">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className={`${styles.plan} ${styles.planLoading}`}>
          <Skeleton width="2.75rem" height="2.75rem" radius="11px" />
          <Skeleton width="55%" height="1.25rem" />
          <Skeleton width="85%" />
          <Skeleton width="100%" height="2rem" radius="9px" />
          <Skeleton width="60%" height="2rem" />
          <Skeleton width="90%" />
          <Skeleton width="75%" />
          <Skeleton width="100%" height="2.75rem" radius="var(--radius-control)" />
        </div>
      ))}
    </div>
  )
}

export default function Plans() {
  const showToast = useToastStore((s) => s.showToast)
  const refreshSessionState = useAuthStore((s) => s.refreshSessionState)
  const authAccess = useAuthStore((s) => s.access)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.organization)

  const [plans, setPlans] = useState([])
  const [access, setAccess] = useState(authAccess || null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(null)
  const [intervals, setIntervals] = useState({})
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [premiumSubmitting, setPremiumSubmitting] = useState(false)
  const [premiumForm, setPremiumForm] = useState(() => defaultPremiumForm(user, organization))
  const [premiumErrors, setPremiumErrors] = useState({})

  useEffect(() => {
    let mounted = true
    Promise.all([subscriptionService.listPlans(), subscriptionService.status()])
      .then(([plansResponse, statusResponse]) => {
        if (!mounted) return
        const nextPlans = plansResponse.data?.data || []
        const nextAccess = statusResponse.data?.data?.access || null
        setPlans(nextPlans)
        setAccess(nextAccess)
        setIntervals(initialIntervals(nextPlans, nextAccess?.subscription))
      })
      .catch((error) => showToast(getErrorMessage(error, 'Unable to load subscription details.'), 'error', 'Subscription unavailable'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [showToast])

  const subscription = access?.subscription || null
  const canManageSubscription = ['owner', 'admin'].includes(String(user?.role || ''))
  const planCountLabel = useMemo(() => (plans.length ? `${plans.length} plan${plans.length === 1 ? '' : 's'} available` : 'No active plans'), [plans.length])
  const pageTitle = subscription ? 'Manage your DigitalInvoice plan' : 'Choose a DigitalInvoice plan'
  const pageDescription = subscription
    ? 'Renew your current subscription, switch to another plan or interval, or cancel renewal while keeping access until the current period ends.'
    : 'Select Starter, Business, Professional or contact us for a fully customizable Premium setup. Switch between monthly, quarterly, 6-month and yearly billing before checkout.'

  const checkout = async (variant) => {
    if (!variant?.code) return
    const action = checkoutActionForVariant(access, subscription, variant)
    setCheckingOut(variant.code)
    try {
      const response = await subscriptionService.initialize(variant.code, action)
      const url = response.data?.data?.authorization_url
      if (!url) throw new Error('Checkout URL was not returned.')
      window.location.assign(url)
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to initialise payment.'), 'error', 'Checkout unavailable')
      setCheckingOut(null)
    }
  }

  const cancelRenewal = async () => {
    setCancelling(true)
    try {
      const response = await subscriptionService.cancelRenewal()
      setAccess(response.data?.data?.access || null)
      await refreshSessionState()
      showToast(response.data?.message || 'Subscription renewal has been cancelled.', 'success', 'Renewal cancelled')
      setCancelOpen(false)
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to cancel subscription renewal.'), 'error', 'Cancellation unavailable')
    } finally {
      setCancelling(false)
    }
  }

  const openPremium = () => {
    const defaults = defaultPremiumForm(user, organization)
    setPremiumForm((current) => ({
      ...current,
      business_name: current.business_name || defaults.business_name,
      contact_name: current.contact_name || defaults.contact_name,
      contact_email: current.contact_email || defaults.contact_email,
      contact_phone: current.contact_phone || defaults.contact_phone,
      required_features: current.required_features?.length ? current.required_features : defaults.required_features,
    }))
    setPremiumErrors({})
    setPremiumOpen(true)
  }

  const updatePremium = (field, value) => {
    setPremiumForm((current) => ({ ...current, [field]: value }))
    setPremiumErrors((current) => ({ ...current, [field]: '' }))
  }

  const toggleFeature = (feature) => setPremiumForm((current) => ({
    ...current,
    required_features: current.required_features.includes(feature)
      ? current.required_features.filter((item) => item !== feature)
      : [...current.required_features, feature],
  }))

  const validatePremium = () => {
    const next = {}
    const email = premiumForm.contact_email.trim()
    if (!premiumForm.business_name.trim()) next.business_name = 'Enter the business name.'
    if (!premiumForm.contact_name.trim()) next.contact_name = 'Enter the contact person.'
    if (!email) next.contact_email = 'Enter the contact email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.contact_email = 'Enter a valid email address.'
    if (!premiumForm.message.trim()) next.message = 'Tell us what your Premium setup should include.'
    setPremiumErrors(next)
    return Object.keys(next).length === 0
  }

  const submitPremium = async () => {
    if (!validatePremium()) return
    setPremiumSubmitting(true)
    try {
      const response = await subscriptionService.requestPremium({
        ...premiumForm,
        business_name: premiumForm.business_name.trim(),
        contact_name: premiumForm.contact_name.trim(),
        contact_email: premiumForm.contact_email.trim(),
        contact_phone: premiumForm.contact_phone.trim(),
        message: premiumForm.message.trim(),
      })
      showToast(response.data?.message || 'Your Premium request has been received.', 'success', 'Premium request sent')
      setPremiumOpen(false)
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to submit your Premium request.'), 'error', 'Premium request failed')
    } finally {
      setPremiumSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <SubscriptionHeader />
      <main id="main-content">
        <section className={styles.band} aria-labelledby="plans-heading">
          <span className={styles.glowA} aria-hidden="true" />
          <span className={styles.glowB} aria-hidden="true" />
          <div className={styles.bandInner}>
            <div className={`${styles.bandCopy} fx-stagger`}>
              <p className={styles.eyebrow}>{subscription ? 'Subscription management' : 'Subscription required'}</p>
              <h1 id="plans-heading">{pageTitle}</h1>
              <p className={styles.description}>{pageDescription}</p>
              <div className={styles.notes}>
                <span><Layers size={15} aria-hidden="true" />{loading ? 'Loading plans…' : planCountLabel}</span>
                <span><ShieldCheck size={15} aria-hidden="true" />Backend-enforced feature access</span>
              </div>
            </div>
            {!loading ? (
              <CurrentSubscription access={access} onCancel={() => setCancelOpen(true)} cancelling={cancelling} canManageSubscription={canManageSubscription} />
            ) : null}
          </div>
        </section>

        {loading ? <LoadingPlans /> : (
          <div className={styles.grid}>
            {plans.map((plan, index) => {
              const key = plan.tier || plan.code
              return (
                <PlanCard
                  key={key}
                  plan={plan}
                  index={index}
                  selectedInterval={intervals[key] || 'monthly'}
                  onInterval={(value) => setIntervals((current) => ({ ...current, [key]: value }))}
                  subscription={subscription}
                  access={access}
                  canManageSubscription={canManageSubscription}
                  checkingOut={checkingOut}
                  onCheckout={checkout}
                  onPremium={openPremium}
                />
              )
            })}
            {!plans.length ? (
              <div className={`${styles.plan} ${styles.empty}`}>
                <span className={styles.planIcon}><PackageOpen size={20} aria-hidden="true" /></span>
                <h3 className={styles.planName}>No active plans</h3>
                <p className={styles.planDesc}>Configure Starter, Business, Professional and Premium plans in the Platform Console before checkout.</p>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <PremiumRequestModal
        open={premiumOpen}
        form={premiumForm}
        errors={premiumErrors}
        loading={premiumSubmitting}
        onClose={() => setPremiumOpen(false)}
        onChange={updatePremium}
        onToggleFeature={toggleFeature}
        onSubmit={submitPremium}
      />
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel subscription renewal?"
        message="Your workspace will remain active until the current period ends. After that, billing and subscription screens remain open so you can renew."
        confirmLabel="Cancel renewal"
        variant="danger"
        loading={cancelling}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelRenewal}
      />
    </div>
  )
}
