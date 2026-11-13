/** Presentation helpers for the existing invoice/document and offline NRS API contracts. */
export function parseLocalNrsReadiness(value) {
  if (!value) return null
  let result = value
  if (typeof value === 'string') {
    try { result = JSON.parse(value) } catch { return null }
  }
  // Never interpret a real sandbox/production transport response as a local test.
  if (!result || typeof result !== 'object' || result.mode !== 'local_readiness_only') return null
  return result
}

export function invoiceMoney(value, currency = 'NGN') {
  const number = Number(value)
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN' }).format(Number.isFinite(number) ? number : 0)
  } catch {
    return `${currency || 'NGN'} ${(Number.isFinite(number) ? number : 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

export const invoiceEditable = (invoice) => ['draft', 'rejected'].includes(invoice?.status)
export const invoiceApproved = (invoice) => invoice?.status === 'approved'
export const invoicePending = (invoice) => invoice?.status === 'pending_approval'

export function snapshotClassification(line) {
  const kind = line?.firs_item_type_snapshot === 'service' ? 'Service' : line?.firs_item_type_snapshot === 'goods' ? 'HS goods' : 'Item'
  return { kind, code: String(line?.nrs_item_classification_snapshot || '').trim(), checked: Boolean(line?.nrs_item_classification_snapshot) }
}

export function validateInvoiceEmail(form) {
  const errors = {}
  const email = String(form?.recipient_email || '').trim()
  const name = String(form?.recipient_name || '').trim()
  const message = String(form?.message || '').trim()
  if (!email) errors.recipient_email = 'Enter the customer email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.recipient_email = 'Enter a valid email address.'
  if (name.length > 120) errors.recipient_name = 'Recipient name must be 120 characters or less.'
  if (message.length > 1200) errors.message = 'Message must be 1,200 characters or less.'
  return errors
}

export const safeInvoiceFilename = (invoice) => (
  String(invoice?.invoice_number || `invoice-${invoice?.id || 'document'}`)
    .replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'invoice'
)
