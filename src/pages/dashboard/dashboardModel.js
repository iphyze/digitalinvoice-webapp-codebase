/**
 * Read-only Dashboard adapters for the existing PHP reporting endpoints.
 * Do not infer NRS clearance, remap currencies, or turn failed API calls into zero values.
 */
export const dashboardPayload = (response) => {
  const payload = response?.data?.data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The dashboard returned an unexpected response. Please try again.')
  }
  return payload
}

export const readDashboardSummary = (response) => {
  const data = dashboardPayload(response)
  const required = ['approved_invoices', 'payments_received', 'outstanding', 'overdue', 'pending_approvals', 'tax_billed', 'collection_rate_percent', 'active_customers', 'active_items', 'nrs_awaiting_submission']
  if (!data.cards || typeof data.cards !== 'object' || required.some((field) => !Object.prototype.hasOwnProperty.call(data.cards, field)) || !data.period?.from || !data.period?.to || !data.currency) {
    throw new Error('The dashboard summary is incomplete. Please refresh.')
  }
  return data
}

export const readDashboardTrends = (response) => {
  const data = dashboardPayload(response)
  const points = Array.isArray(data.points) ? data.points : data.months
  if (!Array.isArray(points) || !['month', 'day'].includes(data.granularity)) {
    throw new Error('The dashboard trends are unavailable. Please refresh.')
  }
  return {
    ...data,
    points: points.map((point) => ({
      key: String(point.key || ''),
      label: String(point.label || point.month || point.key || ''),
      invoiced: safeNumber(point.invoiced_amount),
      collected: safeNumber(point.payment_amount),
      allocated: safeNumber(point.allocated_amount),
    })),
  }
}

export const readDashboardActivity = (response) => {
  const data = dashboardPayload(response)
  if (!Array.isArray(data.activity)) throw new Error('Recent activity is unavailable. Please refresh.')
  return data.activity
}

const safeNumber = (input) => {
  const value = Number(input)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export const dashboardMoney = (value, currency = 'NGN') => {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(safeNumber(value))
  } catch {
    return `${safeNumber(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })} ${currency}`
  }
}

export const dashboardCount = (value) => Math.max(0, Math.trunc(safeNumber(value))).toLocaleString('en-NG')

export const dashboardPercent = (value) => `${safeNumber(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%`

// Date-only SQL values must stay calendar dates, not UTC timestamps.
export const dashboardDate = (value) => {
  if (typeof value !== 'string') return '—'
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0]
  if (!iso) return '—'
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export const dashboardPeriodError = ({ from, to }) => {
  const valid = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  if (!valid(from) || !valid(to)) return 'Choose a valid start and end date.'
  if (from > to) return 'To date cannot be earlier than from date.'
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 366 * 3) {
    return 'A report date range cannot exceed three years.'
  }
  return ''
}

export const dashboardActionName = (value) => String(value || 'Activity').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
