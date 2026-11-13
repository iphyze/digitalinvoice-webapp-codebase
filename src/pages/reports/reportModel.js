/**
 * Contract guards, filters and export helpers for PHP internal reports.
 * This module is UI-free. A server-side total is not the size of one detail page.
 */
import { format } from 'date-fns'
import { createDashboardFilters, getDashboardPresetPeriod } from '../../utils/dashboardFilters'
import { dashboardCount, dashboardDate, dashboardMoney, dashboardPeriodError } from '../dashboard/dashboardModel'

export const REPORT_CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
]
export const REPORT_PERIOD_OPTIONS = [
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'quarter_to_date', label: 'Quarter to date' },
  { value: 'year_to_date', label: 'Year to date' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'prior_year', label: 'Prior year' },
  { value: 'custom', label: 'Custom range' },
]
export const createReportFilters = (preset = 'year_to_date') => ({
  ...createDashboardFilters(preset), search: '', status: 'all', payment_status: 'all',
  nrs_submission_status: 'all', method: '', aging_date: format(new Date(), 'yyyy-MM-dd'),
})
export const reportMoney = dashboardMoney
export const reportCount = dashboardCount
export const reportDate = dashboardDate

export const reportPeriodError = (filters) => {
  const problem = dashboardPeriodError(filters)
  if (problem) return problem
  if (String(filters.search || '').trim().length > 120) return 'Search may not exceed 120 characters.'
  return ''
}
export const isIsoDate = (date) => !dashboardPeriodError({ from: date, to: date })
export const reportPresetDates = getDashboardPresetPeriod

const requiredSummaryKeys = {
  invoices: ['total_records', 'total_document_value', 'approved_value', 'approved_tax', 'approved_outstanding'],
  payments: ['total_records', 'received_amount', 'allocated_amount', 'unallocated_amount', 'voided_amount'],
  aging: ['invoice_count', 'total_outstanding', 'current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_over_90'],
  vat: ['invoice_count', 'net_amount', 'vat_amount', 'gross_amount', 'not_submitted_to_nrs_count'],
}
const hasAllKeys = (value, names) => names.every((name) => Object.prototype.hasOwnProperty.call(value || {}, name))
const hasObject = (value) => value && typeof value === 'object' && !Array.isArray(value)
export const getReportPayload = (response) => {
  const value = response?.data?.data
  if (!hasObject(value)) throw new Error('The report returned an unexpected response. Please try again.')
  return value
}
export const readReport = (response, type) => {
  const result = getReportPayload(response)
  const listName = {
    invoices: 'invoices', payments: 'payments', aging: 'invoices', vat: 'invoices',
    statement: 'transactions', compliance: 'approved_invoices_awaiting_external_submission',
  }[type]
  if (!listName || !Array.isArray(result[listName])) throw new Error('Report records are unavailable. Please refresh.')
  if (type === 'statement') {
    if (result.contract_version !== 'customer-statement-v1' || !hasObject(result.customer)
      || !hasObject(result.organization) || !hasObject(result.summary) || !hasObject(result.period)
      || !result.currency) throw new Error('The customer statement is incomplete. Please try again.')
  } else if (type === 'compliance') {
    if (!hasObject(result.profile) || !hasObject(result.readiness_indicators)
      || !Array.isArray(result.approved_invoice_submission_statuses) || result.submission_enabled !== false) {
      throw new Error('The compliance readiness report is incomplete. Please try again.')
    }
  } else if (!hasObject(result.summary) || !result.currency || (type !== 'aging' && !hasObject(result.period))) {
    throw new Error('The report summary is incomplete. Please try again.')
  }
  if (requiredSummaryKeys[type] && !hasAllKeys(result.summary, requiredSummaryKeys[type])) {
    throw new Error('The report totals are incomplete. Please refresh.')
  }
  if (type === 'aging' && ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_over_90'].some((key) => !hasObject(result.summary[key]) || !hasAllKeys(result.summary[key], ['count', 'amount']))) {
    throw new Error('The aging buckets are incomplete. Please refresh.')
  }
  if ((type === 'invoices' || type === 'payments') && (!hasObject(result.pagination)
    || !Number.isFinite(Number(result.pagination.total)) || Number(result.pagination.total) < 0)) {
    throw new Error('Report pagination is unavailable. Please refresh.')
  }
  if (type === 'vat' && !Array.isArray(result.tax_treatments)) {
    throw new Error('VAT treatment breakdown is unavailable. Please refresh.')
  }
  return result
}

// The API returns entire page totals but only the current page of records.
export const makeReportParams = (type, filter, page = 1, limit = 20) => {
  if (type === 'aging') return {
    aging_date: filter.aging_date, currency: filter.currency,
  }
  const base = { from: filter.from, to: filter.to, currency: filter.currency }
  if (type === 'invoices' || type === 'payments') {
    Object.assign(base, { page, limit, status: filter.status || 'all' })
  }
  if (type === 'invoices') {
    Object.assign(base, { search: filter.search?.trim() || '', payment_status: filter.payment_status || 'all', nrs_submission_status: filter.nrs_submission_status || 'all' })
  }
  if (type === 'payments') {
    Object.assign(base, { search: filter.search?.trim() || '', method: filter.method || '' })
  }
  if (type === 'vat') base.search = filter.search?.trim() || ''
  return base
}

// A safe spreadsheet export: no formula execution from customer names or references.
export const csvCell = (value) => {
  const text = String(value ?? '').replace(/\r\n?/g, '\n')
  const numericNegative = /^-\d+(?:\.\d+)?$/.test(text)
  const escaped = !numericNegative && /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text
  return `"${escaped.replaceAll('"', '""')}"`
}
export const csvContent = (rows, columns) => '\uFEFF' + [
  columns.map((column) => csvCell(column.label)).join(','),
  ...rows.map((record) => columns.map((column) => csvCell(column.value(record))).join(',')),
].join('\r\n')
export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const downloadReportCsv = (name, rows, columns) => {
  downloadFile(new Blob([csvContent(rows, columns)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`)
}
export const statementFilename = (statement) => {
  const customer = String(statement?.customer?.name || 'customer').replace(/[^a-z\d_-]+/gi, '-').slice(0, 65).replace(/^-|-$/g, '') || 'customer'
  const from = String(statement?.period?.from || 'from').replace(/[^\d-]/g, '')
  const to = String(statement?.period?.to || 'to').replace(/[^\d-]/g, '')
  return `digitalinvoice-statement-${customer}-${from}-to-${to}`
}
export const statementSendErrors = (value) => {
  const errors = {}
  const email = String(value.recipient_email || '').trim()
  if (!email || email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.recipient_email = 'Enter a valid customer email address.'
  if (String(value.recipient_name || '').trim().length > 120) errors.recipient_name = 'Recipient name must be 120 characters or less.'
  if (String(value.message || '').trim().length > 1200) errors.message = 'Message must be 1,200 characters or less.'
  return errors
}

export const REPORT_CSV_COLUMNS = {
  invoices: [
    { label: 'Invoice', value: (r) => r.invoice_number }, { label: 'Customer', value: (r) => r.customer_name_snapshot },
    { label: 'Invoice date', value: (r) => r.invoice_date }, { label: 'Due date', value: (r) => r.due_date },
    { label: 'Status', value: (r) => r.status }, { label: 'Payment status', value: (r) => r.payment_status },
    { label: 'Internal NRS status', value: (r) => r.nrs_submission_status },
    { label: 'Currency', value: (r) => r.currency }, { label: 'Net', value: (r) => r.net_amount },
    { label: 'VAT', value: (r) => r.tax_amount }, { label: 'Total', value: (r) => r.total_amount },
    { label: 'Paid', value: (r) => r.amount_paid }, { label: 'Outstanding', value: (r) => r.balance_due },
  ],
  payments: [
    { label: 'Receipt', value: (r) => r.receipt_number }, { label: 'Customer', value: (r) => r.customer_name_snapshot },
    { label: 'Date', value: (r) => r.payment_date }, { label: 'Status', value: (r) => r.status },
    { label: 'Method', value: (r) => r.payment_method }, { label: 'Reference', value: (r) => r.reference },
    { label: 'Currency', value: (r) => r.currency }, { label: 'Amount', value: (r) => r.amount },
    { label: 'Allocated', value: (r) => r.allocated_amount }, { label: 'Unallocated', value: (r) => r.unallocated_amount },
  ],
  aging: [
    { label: 'Invoice', value: (r) => r.invoice_number }, { label: 'Customer', value: (r) => r.customer_name_snapshot },
    { label: 'Date', value: (r) => r.invoice_date }, { label: 'Due', value: (r) => r.due_date },
    { label: 'Days past due', value: (r) => r.days_past_due }, { label: 'Currency', value: (r) => r.currency },
    { label: 'Balance due', value: (r) => r.balance_due },
  ],
  vat: [
    { label: 'Invoice', value: (r) => r.invoice_number }, { label: 'Customer', value: (r) => r.customer_name_snapshot },
    { label: 'Customer TIN', value: (r) => r.customer_tin_snapshot }, { label: 'Date', value: (r) => r.invoice_date },
    { label: 'Currency', value: (r) => r.currency }, { label: 'Net', value: (r) => r.taxable_amount },
    { label: 'VAT', value: (r) => r.tax_amount }, { label: 'Gross', value: (r) => r.total_amount },
  ],
  statement: [
    { label: 'Date', value: (r) => r.transaction_date }, { label: 'Type', value: (r) => r.description },
    { label: 'Reference', value: (r) => r.reference }, { label: 'Debit', value: (r) => r.debit },
    { label: 'Credit', value: (r) => r.credit }, { label: 'Running balance', value: (r) => r.running_balance },
  ],
}
