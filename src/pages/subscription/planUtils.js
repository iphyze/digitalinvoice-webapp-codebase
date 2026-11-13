// Plan and checkout helpers carried over unchanged from the previous app's Plans page.
export const BILLING_INTERVALS = [
  { value: 'monthly', label: 'Monthly', short: 'mo' },
  { value: 'quarterly', label: 'Quarterly', short: 'qtr' },
  { value: 'biannually', label: '6 months', short: '6 mo' },
  { value: 'annually', label: 'Yearly', short: 'yr' },
]

export const intervalLabel = (interval) => BILLING_INTERVALS.find((o) => o.value === interval)?.label || 'Custom'
export const intervalShortLabel = (interval) => BILLING_INTERVALS.find((o) => o.value === interval)?.short || 'custom'
export const discountPercent = (variant) => Number(variant?.discount_percent || 0)
export const hasDiscount = (variant) => discountPercent(variant) > 0 && !['monthly', 'custom'].includes(variant?.billing_interval || '')
export const discountLabel = (variant) => {
  const value = discountPercent(variant)
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2).replace(/\.?0+$/, '')}%`
}
export const actualAmountKobo = (variant) => Number(variant?.actual_amount_kobo ?? variant?.amount_kobo ?? 0)
export const discountedAmountKobo = (variant) => Number(variant?.amount_kobo ?? 0)
export const shouldShowActualAmount = (variant) => hasDiscount(variant) && actualAmountKobo(variant) > discountedAmountKobo(variant)

export const intervalMapForPlan = (plan) => {
  if (plan?.prices && typeof plan.prices === 'object') return plan.prices
  return (plan?.intervals || []).reduce((map, variant) => ({ ...map, [variant.billing_interval]: variant }), {})
}
export const variantForPlan = (plan, selectedInterval) => {
  const map = intervalMapForPlan(plan)
  if (map[selectedInterval]) return map[selectedInterval]
  if (map.monthly) return map.monthly
  return (plan?.intervals || [])[0] || plan
}

export const normalizeStatus = (status) => String(status || '').toLowerCase()
// Fix: the previous app compared missing ids as 0 === 0, so the Premium contact
// plan (no id) showed "Current" even without a subscription. Both ids must exist.
export const currentPlanMatches = (subscription, variant) => (
  Boolean(subscription?.plan_id && variant?.id) && Number(subscription.plan_id) === Number(variant.id)
)
export const hasActiveAccess = (access) => Boolean(access?.has_product_access)
export const canRenewStage = (access) => ['payment_required', 'subscription_expired', 'subscription_required', 'payment_pending'].includes(access?.stage)

export const checkoutActionForVariant = (access, subscription, variant) => {
  if (!subscription?.id) return 'subscribe'
  if (hasActiveAccess(access)) return currentPlanMatches(subscription, variant) ? 'renew' : 'change'
  return 'renew'
}

export const buttonLabelForVariant = (access, subscription, variant, canManageSubscription = true) => {
  if (!canManageSubscription) return 'Owner/admin only'
  if (!variant?.available_for_checkout) return 'Plan setup pending'
  const interval = intervalLabel(variant?.billing_interval)
  if (!subscription?.id) return `Subscribe ${interval}`
  if (hasActiveAccess(access)) return currentPlanMatches(subscription, variant) ? `Renew ${interval}` : `Switch to ${interval}`
  if (canRenewStage(access)) return `Renew with ${interval}`
  return `Subscribe ${interval}`
}

export const initialIntervals = (plans, subscription) => plans.reduce((state, plan) => {
  const map = intervalMapForPlan(plan)
  const key = plan.tier || plan.code
  const currentVariant = (plan.intervals || []).find((variant) => Number(variant.id) === Number(subscription?.plan_id))
  return {
    ...state,
    [key]: currentVariant?.billing_interval || (map.monthly ? 'monthly' : (plan.billing_interval === 'custom' ? 'monthly' : (plan.billing_interval || 'monthly'))),
  }
}, {})
