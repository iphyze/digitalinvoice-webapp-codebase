/** Platform revenue and audit models. No presentation or browser dependencies. */
import { unwrap, list } from './platformModel'

export const REVENUE_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
]

export const ACTIVITY_GROUPS = [
  { value: 'all', label: 'All platform activity' },
  { value: 'subscriptions', label: 'Subscription controls' },
  { value: 'payments', label: 'Payment operations' },
  { value: 'plans', label: 'Plan management' },
  { value: 'users', label: 'Platform user access' },
]

const safePage = (value) => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : 1
}
const safeLimit = (value, fallback) => [10, 15, 20, 50].includes(Number(value)) ? Number(value) : fallback
const trimmed = (value) => String(value || '').trim()
const hasDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text) && (() => {
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
})()
const safePositiveId = (value) => /^\d+$/.test(String(value || '')) && Number(value) > 0 && Number.isSafeInteger(Number(value)) ? String(value) : ''

export function readRevenueParams(params) {
  return {
    page: safePage(params.get('page')),
    limit: safeLimit(params.get('limit'), 10),
    search: trimmed(params.get('search')).slice(0, 140),
    status: REVENUE_STATUSES.some((item) => item.value === params.get('status')) ? (params.get('status') || '') : '',
    plan_id: safePositiveId(params.get('plan_id')),
    date_from: trimmed(params.get('date_from')),
    date_to: trimmed(params.get('date_to')),
  }
}

export function readActivityParams(params) {
  return {
    page: safePage(params.get('page')),
    limit: safeLimit(params.get('limit'), 15),
    search: trimmed(params.get('search')).slice(0, 140),
    group: ACTIVITY_GROUPS.some((item) => item.value === params.get('group')) ? params.get('group') : 'all',
    actor_id: safePositiveId(params.get('actor_id')),
    client_id: safePositiveId(params.get('client_id')),
    date_from: trimmed(params.get('date_from')),
    date_to: trimmed(params.get('date_to')),
  }
}

export function validateInsightDates({ date_from, date_to }) {
  if (date_from && !hasDate(date_from)) return 'Enter a valid start date.'
  if (date_to && !hasDate(date_to)) return 'Enter a valid end date.'
  if (date_from && date_to && date_from > date_to) return 'Start date cannot be later than end date.'
  return ''
}

export function validateRevenueDraft(draft) {
  if (trimmed(draft.search).length > 140) return 'Search must be 140 characters or fewer.'
  return validateInsightDates(draft)
}
export function validateActivityDraft(draft) {
  if (trimmed(draft.search).length > 140) return 'Search must be 140 characters or fewer.'
  return validateInsightDates(draft)
}

export function queryStringPayload(draft, { page = 1, limit = 10 } = {}) {
  const values = { ...draft, page, limit }
  return Object.fromEntries(Object.entries(values).filter(([key, val]) => {
    if (val === '' || val === undefined || val === null) return false
    if (key === 'group' && val === 'all') return false
    if (key === 'page' && Number(val) === 1) return false
    return true
  }))
}

const hasCounters = (summary, keys) => keys.every((key) => summary[key] !== null && summary[key] !== undefined && summary[key] !== '' && Number.isFinite(Number(summary[key])) && Number(summary[key]) >= 0)
const hasPagination = (pagination) => ['page', 'limit', 'total', 'total_pages'].every((key) => pagination[key] !== null && pagination[key] !== undefined && Number.isSafeInteger(Number(pagination[key])) && Number(pagination[key]) >= (key === 'total' ? 0 : 1))

// Reject missing/ambiguous monetary summaries instead of treating them as zero.
// No exchange-rate conversions are implied by any of the rows.
export function validCurrencyRows(rows, fields) {
  return Array.isArray(rows) && rows.every((row) =>
    row && typeof row === 'object' && /^[A-Z]{3}$/.test(String(row.currency || ''))
    && fields.every((field) => typeof row[field] === 'string'
      && /^\d+\.\d{2}$/.test(row[field]) && Number.isFinite(Number(row[field])))
  ) && new Set(rows.map((row) => row.currency)).size === rows.length
}

export function normalizeRevenue(response) {
  const data = unwrap(response, ['summary', 'payments', 'pagination', 'plans', 'plan_breakdown', 'monthly_collections', 'status_breakdown', 'currency_breakdown', 'filtered_currency_breakdown'])
  if (!data.summary || typeof data.summary !== 'object' || !data.pagination || typeof data.pagination !== 'object'
    || !Array.isArray(data.payments) || !Array.isArray(data.plans)
    || !Array.isArray(data.plan_breakdown) || !Array.isArray(data.monthly_collections)
    || !Array.isArray(data.status_breakdown)
    || !validCurrencyRows(data.currency_breakdown, ['lifetime_revenue', 'month_revenue', 'previous_month_revenue', 'mrr', 'arr'])
    || !validCurrencyRows(data.filtered_currency_breakdown, ['paid_amount'])
    || !hasCounters(data.summary, ['paid_transactions', 'monthly_paid_transactions', 'open_payment_issues', 'recurring_clients', 'filtered_paid_transactions', 'filtered_pending_transactions', 'filtered_failed_transactions'])
    || !hasPagination(data.pagination)) {
    throw new Error('The revenue service returned an unexpected response. Please retry.')
  }
  return data
}
export function normalizePlatformActivity(response) {
  const data = unwrap(response, ['summary', 'events', 'pagination', 'actors', 'clients', 'groups'])
  if (!data.summary || typeof data.summary !== 'object' || !data.pagination || typeof data.pagination !== 'object'
    || !Array.isArray(data.events) || !Array.isArray(data.actors)
    || !Array.isArray(data.clients) || !Array.isArray(data.groups)
    || !hasCounters(data.summary, ['total_events', 'recent_events', 'access_events', 'subscription_events', 'affected_clients'])
    || !hasPagination(data.pagination)) {
    throw new Error('The activity service returned an unexpected response. Please retry.')
  }
  return data
}

export const activityTitle = (value) => trimmed(value).replace(/^platform\./, '').replaceAll(/[._]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Activity'
export function activityTimestamp(value) {
  if (!value) return '—'
  const stamp = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(stamp.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(stamp)
}
export const activityTone = (value) => ['success', 'info', 'danger', 'warning'].includes(value) ? value : 'neutral'
export const activeOptions = (rows, selected, allLabel, display) => {
  const options = [{ value: '', label: allLabel }, ...list(rows).map((row) => ({ value: String(row.id), label: display(row) }))]
  if (selected && !options.some((option) => option.value === selected)) options.push({ value: selected, label: `ID ${selected} (outside recent options)` })
  return options
}
