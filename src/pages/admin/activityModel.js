export const GROUP_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'auth', label: 'Authentication' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'organization', label: 'Organisation' },
  { value: 'customers', label: 'Customers' },
  { value: 'catalogue', label: 'Catalogue' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'team', label: 'Team' },
]
export const readPage = (value) => Math.max(1, Math.floor(Number(value) || 1))
export const readLimit = (value) => [10, 20, 50].includes(Number(value)) ? Number(value) : 10
export const normalizeActivity = (response) => {
  const data = response?.data?.data
  if (!data || !Array.isArray(data.activities) || !data.summary || !data.pagination) {
    throw new Error('Activity log response was incomplete. Please retry.')
  }
  return { activities: data.activities, summary: data.summary, pagination: data.pagination }
}
export const validateActivityFilters = ({ search, from, to }) => {
  if (search.length > 120) return 'Search must be no longer than 120 characters.'
  if (from && to && from > to) return 'To date cannot be earlier than from date.'
  return ''
}
export const humanAction = (value) => String(value || 'Activity').replaceAll(/[._]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
export const activityTimestamp = (value) => {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
