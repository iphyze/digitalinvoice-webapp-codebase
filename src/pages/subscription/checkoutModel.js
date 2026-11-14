/** Pure checkout presentation rules; never imply that a pending payment grants access. */
export const checkoutIsOpen = (payment) => Boolean(payment && payment.status === 'pending' && !payment.closed_reason)
export const checkoutMatchesVariant = (payment, variant) => checkoutIsOpen(payment) && Boolean(variant?.code) && payment.plan_code === variant.code
export const activePlanMatchesVariant = (access, subscription, variant) => Boolean(
  access?.has_product_access && subscription?.plan_id && variant?.id && Number(subscription.plan_id) === Number(variant.id),
)
export const trustedCheckoutUrl = (value) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'checkout.paystack.com' && url.username === '' && url.password === '' && url.pathname.length > 1 ? url.href : null
  } catch { return null }
}
