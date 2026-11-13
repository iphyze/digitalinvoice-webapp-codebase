import { formatCurrency } from '../../utils/formatters'
import { paymentMethodLabel, paymentMethodOptions } from '../../components/documents/labels'
import { paymentListFromResponse } from '../../utils/paymentPayload'

export const PAYMENT_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'received', label: 'Received' },
  { value: 'partially_allocated', label: 'Partially allocated' },
  { value: 'allocated', label: 'Fully allocated' },
  { value: 'void', label: 'Voided' },
]
export const PAYMENT_METHODS = [{ value: '', label: 'All methods' }, ...paymentMethodOptions]
export const paymentStatusLabel = (value) => PAYMENT_STATUSES.find((status) => status.value === value)?.label || 'Unknown'
export const paymentStatusTone = (value) => ({ received: 'info', partially_allocated: 'warning', allocated: 'success', void: 'danger' }[value] || 'neutral')
export const paymentReference = (payment) => payment?.receipt_number || `Receipt #${payment?.id || '—'}`
export const paymentMethodText = (payment) => paymentMethodLabel(payment?.payment_method)
export const paymentMoney = (value, currency = 'NGN') => formatCurrency(Number(value ?? 0), currency || 'NGN')
export const paymentCollection = paymentListFromResponse
export const paymentActive = (payment) => payment?.status !== 'void'
export const paymentCanAllocate = (payment) => paymentActive(payment) && moneyToMinor(payment?.unallocated_amount) > 0
export const dateToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const moneyToMinor = (value) => {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN
  const [major, fraction = ''] = text.split('.')
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : NaN
}
export const validPaymentDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const day = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value
}
const emailOK = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export function validatePaymentRecord(form) {
  const errors = {}
  if (!(Number(form.customer_id) > 0)) errors.customer_id = 'Select a customer.'
  if (!validPaymentDate(form.payment_date)) errors.payment_date = 'Select a valid payment date.'
  if (!form.currency || !/^[A-Z]{3}$/.test(form.currency)) errors.currency = 'Select a payment currency.'
  const amount = moneyToMinor(form.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) errors.amount = 'Enter an amount greater than zero, with at most two decimal places.'
  if (!paymentMethodOptions.some((entry) => entry.value === form.payment_method)) errors.payment_method = 'Select a valid payment method.'
  if (String(form.reference || '').trim().length > 120) errors.reference = 'Reference must not exceed 120 characters.'
  if (String(form.payer_name || '').trim().length > 180) errors.payer_name = 'Payer name must not exceed 180 characters.'
  if (String(form.notes || '').trim().length > 1000) errors.notes = 'Notes must not exceed 1,000 characters.'
  return errors
}

export function validatePaymentAllocations(payment, rows, invoices) {
  const errors = {}
  const entries = Array.isArray(rows) ? rows : []
  const selected = entries.filter((row) => row.invoice_id)
  if (!selected.length) errors.general = 'Select at least one invoice to allocate.'
  if (selected.length > 100) errors.general = 'You can allocate a payment to at most 100 invoices.'
  const ids = new Set()
  let amountTotal = 0
  for (const [index, row] of entries.entries()) {
    if (!row.invoice_id) continue
    const id = String(row.invoice_id)
    const invoice = invoices.find((entry) => String(entry.id) === id)
    if (ids.has(id)) errors[index] = 'Select each invoice only once.'
    ids.add(id)
    if (!invoice || Number(invoice.customer_id) !== Number(payment.customer_id) || invoice.currency !== payment.currency) {
      errors[index] = 'This invoice is not eligible for this payment.'
      continue
    }
    const minor = moneyToMinor(row.amount)
    if (!Number.isSafeInteger(minor) || minor <= 0) errors[index] = 'Enter a positive amount with at most two decimal places.'
    else if (minor > moneyToMinor(invoice.balance_due)) errors[index] = 'Allocation exceeds the invoice balance.'
    else amountTotal += minor
  }
  if (amountTotal > moneyToMinor(payment.unallocated_amount)) errors.general = 'Allocations exceed this payment’s unallocated balance.'
  return errors
}

export function validatePaymentEmail(form) {
  const errors = {}
  const email = String(form.recipient_email || '').trim()
  if (!emailOK(email) || email.length > 254) errors.recipient_email = 'Enter a valid recipient email address.'
  if (String(form.recipient_name || '').trim().length > 120) errors.recipient_name = 'Recipient name must be 120 characters or less.'
  if (String(form.message || '').trim().length > 1200) errors.message = 'Message must be 1,200 characters or less.'
  return errors
}
export const safePaymentFilename = (payment) => `receipt-${paymentReference(payment).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || payment.id}`
