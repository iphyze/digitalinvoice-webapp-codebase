// Platform API contracts; intentionally UI-free. Do not infer an empty dataset from a failed response.
export const unwrap = (response, required = []) => {
  const payload = response?.data?.data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || required.some((key) => !(key in payload))) {
    throw new Error('The platform service returned an unexpected response. Please retry.')
  }
  return payload
}
export const list = (value) => Array.isArray(value) ? value : []
export const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
export const count = (value) => number(value).toLocaleString('en-NG')
export const money = (value, currency = 'NGN') => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}
export const date = (value) => {
  if (!value) return '—'
  const parsed = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(parsed)
}
export const label = (value) => String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())
export { platformPermission as permission } from '../../utils/platformPermissions'
export const platformRoles = (roles, actorRole) => Object.entries(roles || {}).filter(([key]) => actorRole === 'owner' || key !== 'owner')
  .map(([value, details]) => ({ value, label: details.label || label(value) }))
export const validateInvite = (draft, roles, actorRole) => {
  const errors = {}
  const name = String(draft.name || '').trim()
  const email = String(draft.email || '').trim()
  if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.'
  if (!Object.prototype.hasOwnProperty.call(roles || {}, draft.platform_role) || (draft.platform_role === 'owner' && actorRole !== 'owner')) errors.platform_role = 'Select an available platform role.'
  return errors
}
export const clientAction = (client, action, reason = '') => {
  if (!['activate', 'suspend', 'archive'].includes(action)) throw new Error('Select a valid account action.')
  if (String(reason).trim().length > 500) throw new Error('Reason must be 500 characters or fewer.')
  if (!Number.isInteger(Number(client?.id)) || Number(client.id) <= 0) throw new Error('Invalid workspace ID.')
  return { id: Number(client.id), action, reason: String(reason).trim() }
}
export const CLIENT_STATUSES = [
  { value: '', label: 'All statuses' },
  ...['active', 'subscription_required', 'pending_verification', 'suspended', 'archived'].map((value) => ({ value, label: label(value) })),
]
export const SUBSCRIPTION_STATUSES = [
  { value: '', label: 'All subscriptions' },
  ...['active', 'trialing', 'pending', 'past_due', 'non_renewing', 'cancelled', 'expired', 'none'].map((value) => ({ value, label: label(value) })),
]

/** Avoid reporting a different client's page as though requested pagination worked. */
export const assertClientPagination = (data, page, limit) => {
  const pagination = data?.pagination
  if (!pagination || !Number.isInteger(Number(pagination.page)) || !Number.isInteger(Number(pagination.limit))
    || Number(pagination.page) !== page || Number(pagination.limit) !== limit
    || !Number.isFinite(Number(pagination.total)) || Number(pagination.total) < 0) {
    throw new Error('The client register pagination does not match this request. Update the PHP API and retry.')
  }
  return data
}


/** Reject ambiguous or malformed currency summaries before rendering. */
export const assertCurrencyAmounts = (rows) => {
  if (!Array.isArray(rows)) throw new Error('The platform service did not provide currency-separated totals.')
  const codes = new Set()
  for (const row of rows) {
    if (!row || !/^[A-Z]{3}$/.test(String(row.currency || ''))
      || typeof row.amount !== 'string' || !/^\d+\.\d{2}$/.test(row.amount)
      || !Number.isFinite(Number(row.amount)) || codes.has(row.currency)) {
      throw new Error('The platform service returned invalid currency-separated totals.')
    }
    codes.add(row.currency)
  }
  return rows
}
