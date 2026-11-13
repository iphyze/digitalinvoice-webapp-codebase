/** Platform billing API contract helpers. Keep independent from display components. */
import { PLAN_FEATURES, PLAN_LIMITS, defaultEntitlements, normalizeEntitlements } from '../../utils/entitlements'

export const BILLING_INTERVALS = [
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannually', label: 'Every six months' }, { value: 'annually', label: 'Annually' },
]
export const PLAN_STATUS_OPTIONS = [
  { value: '', label: 'All plans' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
]
export const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['pending', 'trialing', 'active', 'past_due', 'non_renewing', 'cancelled', 'expired'].map((value) => ({ value, label: value.replaceAll('_', ' ') })),
]
export const SUBSCRIPTION_PERIOD_OPTIONS = [
  { value: '', label: 'Any expiry' }, { value: 'expiring_14', label: 'Next 14 days' },
  { value: 'expiring_30', label: 'Next 30 days' }, { value: 'expired', label: 'Past expiry' },
  { value: 'no_end_date', label: 'No expiry date' },
]
export const PREMIUM_STATUSES = ['new', 'contacted', 'negotiating', 'converted', 'closed']
export const PREMIUM_STATUS_OPTIONS = [{ value: '', label: 'All requests' }, ...PREMIUM_STATUSES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]
export const billingPageParams = (params, keys) => {
  const result = { page: Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1), limit: [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 10 }
  keys.forEach((key) => { const value = params.get(key); if (value) result[key] = value })
  return result
}
export const pageMeta = (data) => ({ page: Number(data?.pagination?.page) || 1, total: Number(data?.pagination?.total) || 0, totalPages: Number(data?.pagination?.total_pages) || 1, limit: Number(data?.pagination?.limit) || 10 })
const normalizedCode = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
export const planForm = (item = null) => ({
  id: item?.id || null,
  name: item?.name || '',
  code: item?.code || '',
  description: item?.description || '',
  actual_amount: item ? String(item.actual_amount ?? '') : '',
  discount_percent: item ? String(item.discount_percent ?? 0) : '0',
  billing_interval: item?.billing_interval || 'monthly',
  currency: item?.currency || 'NGN',
  paystack_plan_code: item?.paystack_plan_code || '',
  features_text: Array.isArray(item?.features) ? item.features.join('\n') : '',
  entitlements: normalizeEntitlements(item?.entitlements || defaultEntitlements),
  is_active: item ? Boolean(item.is_active) : true,
  sort_order: Number(item?.sort_order || 0),
})
export const isPremiumPlan = (draft) => draft?.entitlements?.tier === 'premium' || /premium/.test(`${draft?.code || ''} ${draft?.name || ''}`.toLowerCase())
export const previewPlanPrice = (draft) => {
  if (isPremiumPlan(draft)) return 0
  const actual = Number(String(draft.actual_amount || '0').replaceAll(',', ''))
  const discount = draft.billing_interval === 'monthly' ? 0 : Number(draft.discount_percent || 0)
  return Number.isFinite(actual) && Number.isFinite(discount) ? Math.round(actual * (100 - discount)) / 100 : NaN
}
export function validatePlan(draft) {
  const errors = {}
  if (!draft.name.trim()) errors.name = 'Enter the plan name.'
  else if (draft.name.trim().length > 100) errors.name = 'Plan name must be 100 characters or fewer.'
  const code = normalizedCode(draft.code || `${draft.name}-${draft.billing_interval}`)
  if (code.length < 3) errors.code = 'Plan code must have at least 3 letters or digits.'
  if (!BILLING_INTERVALS.some((i) => i.value === draft.billing_interval)) errors.billing_interval = 'Select a valid billing interval.'
  if (!isPremiumPlan(draft)) {
    const actual = Number(String(draft.actual_amount).replaceAll(',', ''))
    const discount = Number(draft.discount_percent)
    if (!Number.isFinite(actual) || actual < 1 || !/^\d+(?:\.\d{1,2})?$/.test(String(draft.actual_amount).replaceAll(',', ''))) errors.actual_amount = 'Enter an amount of at least ₦1, with up to two decimals.'
    if (!Number.isFinite(discount) || discount < 0 || discount > 100 || !/^\d+(?:\.\d{1,2})?$/.test(String(draft.discount_percent))) errors.discount_percent = 'Use a percentage between 0 and 100.'
    if (!errors.actual_amount && !errors.discount_percent && previewPlanPrice(draft) < 1) errors.discount_percent = 'Discounted total must be at least ₦1.'
  }
  if (!/^[A-Z]{3}$/.test(String(draft.currency).trim().toUpperCase())) errors.currency = 'Currency must have three letters.'
  if (draft.description.length > 1000) errors.description = 'Description must be 1,000 characters or fewer.'
  if (draft.paystack_plan_code.length > 100) errors.paystack_plan_code = 'Paystack code must be 100 characters or fewer.'
  const features = draft.features_text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
  if (features.length > 30) errors.features_text = 'Enter no more than 30 feature lines.'
  if (features.some((v) => v.length > 160)) errors.features_text = 'Each feature line must be 160 characters or fewer.'
  if (!Number.isInteger(Number(draft.sort_order)) || Number(draft.sort_order) < 0) errors.sort_order = 'Use a non-negative whole number.'
  if (!isPremiumPlan(draft)) {
    for (const limit of PLAN_LIMITS) {
      const value = draft.entitlements?.limits?.[limit.key]
      if (!Number.isInteger(Number(value)) || Number(value) < -1) errors[`limit_${limit.key}`] = 'Use -1 for unlimited or a whole number of zero or more.'
    }
  }
  return errors
}
export function planPayload(draft) {
  const errors = validatePlan(draft)
  if (Object.keys(errors).length) return { errors, payload: null }
  const premium = isPremiumPlan(draft)
  const entitlements = premium ? normalizeEntitlements({ tier: 'premium' }) : normalizeEntitlements(draft.entitlements)
  return { errors: {}, payload: {
    ...(draft.id ? { id: draft.id } : {}), code: normalizedCode(draft.code || `${draft.name}-${draft.billing_interval}`),
    name: draft.name.trim(), description: draft.description.trim(), billing_interval: draft.billing_interval,
    actual_amount: premium ? 0 : Number(String(draft.actual_amount).replaceAll(',', '')),
    discount_percent: premium || draft.billing_interval === 'monthly' ? 0 : Number(draft.discount_percent),
    currency: draft.currency.trim().toUpperCase(), paystack_plan_code: premium ? '' : draft.paystack_plan_code.trim(),
    features: [...new Set(draft.features_text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean))],
    entitlements, is_active: draft.is_active, sort_order: Number(draft.sort_order),
  } }
}
export const features = PLAN_FEATURES
export const limits = PLAN_LIMITS
export const dateInput = (value) => String(value || '').slice(0, 10)
export const validFutureDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()) && new Date(`${value}T23:59:59`).getTime() > Date.now()
export function subscriptionPayload(action, draft, subscription) {
  const id = Number(subscription?.id)
  if (!Number.isInteger(id) || id < 1) throw new Error('Invalid subscription ID.')
  const payload = { id, action }
  if (action === 'change_plan') {
    if (!Number.isInteger(Number(draft.plan_id)) || Number(draft.plan_id) < 1) throw new Error('Select an active plan.')
    payload.plan_id = Number(draft.plan_id)
    payload.reset_period = Boolean(draft.reset_period)
  } else if (action === 'extend_period') {
    if (!validFutureDate(draft.current_period_end)) throw new Error('Choose a future expiry date.')
    payload.current_period_end = draft.current_period_end
  } else if (action === 'reactivate') {
    if (draft.current_period_end && !validFutureDate(draft.current_period_end)) throw new Error('Choose a future expiry date or leave it blank for the plan default.')
    if (draft.current_period_end) payload.current_period_end = draft.current_period_end
  } else if (action === 'record_manual_payment') {
    const amount = Number(String(draft.amount).replaceAll(',', ''))
    if (!Number.isFinite(amount) || amount < 1 || !/^\d+(?:\.\d{1,2})?$/.test(String(draft.amount).replaceAll(',', ''))) throw new Error('Enter a verified amount of at least ₦1 (up to two decimals).')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.paid_at || '') || Number.isNaN(new Date(draft.paid_at).getTime())) throw new Error('Select a valid payment date.')
    if (draft.payment_reference?.length > 100) throw new Error('Payment reference must be at most 100 characters.')
    if (draft.current_period_end && !validFutureDate(draft.current_period_end)) throw new Error('Choose a future expiry date or leave it blank to use the plan interval.')
    payload.amount = amount
    payload.currency = subscription.currency || 'NGN'
    payload.paid_at = draft.paid_at
    payload.payment_reference = draft.payment_reference?.trim() || ''
    if (draft.current_period_end) payload.current_period_end = draft.current_period_end
  } else if (action === 'cancel') {
    if (draft.reason?.length > 500) throw new Error('Reason must be 500 characters or fewer.')
    payload.reason = draft.reason?.trim() || ''
  } else if (action === 'verify_payment' && draft.payment_reference?.trim()) {
    payload.payment_reference = draft.payment_reference.trim()
  } else if (action !== 'refresh_provider' && action !== 'verify_payment') throw new Error('Unsupported subscription action.')
  if (draft.note?.trim()) payload.note = draft.note.trim()
  return payload
}
export function premiumPayload(item, status, note) {
  if (!PREMIUM_STATUSES.includes(status)) throw new Error('Select a valid request status.')
  if (String(note).length > 5000) throw new Error('Internal note must be 5,000 characters or fewer.')
  // Explicitly preserve assignment: the PHP PUT handler clears it if omitted.
  return { id: Number(item.id), status, admin_note: String(note).trim(), assigned_to_user_id: item.assigned_to_user_id || null }
}
