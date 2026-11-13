import { format } from 'date-fns'

export const DELIVERY_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
]

export const deliveryReference = (record) => record?.delivery_note_number || `Draft #${record?.id || '—'}`
export const deliveryStatusLabel = (status) => DELIVERY_STATUSES.find((entry) => entry.value === status)?.label || String(status || 'Unknown')
export const deliveryStatusTone = (status) => status === 'issued' ? 'success' : 'neutral'
export const deliveryEditable = (record) => record?.status === 'draft' && !record?.archived_at
export const deliveryIssued = (record) => record?.status === 'issued' && !record?.archived_at
export const deliveryFilename = (record) => String(record?.delivery_note_number || `delivery-note-${record?.id || 'document'}`)
  .replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'delivery-note'

export function deliveryCollection(response) {
  const data = response?.data?.data || {}
  return {
    records: Array.isArray(data.delivery_notes) ? data.delivery_notes : [],
    pagination: data.pagination || { page: 1, limit: 10, total: 0, total_pages: 0 },
  }
}
export const deliveryRecord = (response) => response?.data?.data?.delivery_note || response?.data?.delivery_note || null
export const deliverySavedId = (response) => Number(deliveryRecord(response)?.id || 0)
export const deliverySource = (response) => response?.data?.data || {}

export const initialDelivery = () => ({
  invoice_id: '', delivery_date: format(new Date(), 'yyyy-MM-dd'),
  delivery_address: '', reference: '', notes: '', items: [],
})
export const fromDelivery = (record) => ({
  invoice_id: String(record?.invoice_id || ''),
  delivery_date: record?.delivery_date || format(new Date(), 'yyyy-MM-dd'),
  delivery_address: record?.delivery_address || '',
  reference: record?.reference || '', notes: record?.notes || '',
  items: Array.isArray(record?.items) ? record.items.map((line) => ({
    invoice_item_id: Number(line.invoice_item_id), delivered_quantity: String(line.delivered_quantity), selected: true,
  })) : [],
})

export function mergeDeliveryLines(sourceItems = [], currentItems = []) {
  const selected = new Map(currentItems.map((line) => [String(line.invoice_item_id), line]))
  return sourceItems.map((item) => {
    const prior = selected.get(String(item.invoice_item_id))
    return {
      invoice_item_id: Number(item.invoice_item_id),
      selected: Boolean(prior?.selected),
      delivered_quantity: prior?.delivered_quantity || '',
    }
  })
}

export const selectedDeliveryLines = (form) => (form.items || []).filter((line) => line.selected)

const isRealDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
export function validateDelivery(form, source) {
  const errors = {}
  const invoice = source?.invoice
  if (!invoice || invoice.status !== 'approved' || String(invoice.id) !== String(form.invoice_id)) {
    errors.invoice_id = 'Select an approved source invoice.'
  }
  if (!isRealDate(form.delivery_date)) errors.delivery_date = 'Select a valid delivery date.'
  else if (invoice?.invoice_date && form.delivery_date < invoice.invoice_date) {
    errors.delivery_date = 'Delivery date cannot be earlier than the source invoice date.'
  }
  if (Array.from(form.delivery_address.trim()).length > 1000) errors.delivery_address = 'Use 1,000 characters or fewer.'
  if (Array.from(form.reference.trim()).length > 100) errors.reference = 'Use 100 characters or fewer.'
  if (Array.from(form.notes.trim()).length > 2000) errors.notes = 'Use 2,000 characters or fewer.'
  const available = new Map((source?.deliverable_items || []).map((line) => [String(line.invoice_item_id), line]))
  const selected = selectedDeliveryLines(form)
  if (selected.length < 1 || selected.length > 100) errors.items = 'Select between 1 and 100 invoice lines to deliver.'
  const seen = new Set()
  for (const line of selected) {
    const id = String(line.invoice_item_id)
    const sourceLine = available.get(id)
    const text = String(line.delivered_quantity || '').trim()
    const qty = Number(text)
    const remaining = Number(sourceLine?.remaining_quantity || 0)
    if (seen.has(id) || !sourceLine || !/^\d+(?:\.\d{1,4})?$/.test(text) ||
      !Number.isFinite(qty) || qty <= 0 || qty > remaining + 0.00000001) {
      errors[`quantity.${id}`] = 'Enter a positive quantity no greater than remaining stock (4 decimal places max).'
    }
    seen.add(id)
  }
  return errors
}
export const deliveryPayload = (form, action = 'draft', id) => ({
  ...(id ? { id: Number(id) } : {}),
  invoice_id: Number(form.invoice_id),
  save_action: action,
  delivery_date: form.delivery_date,
  delivery_address: form.delivery_address.trim() || null,
  reference: form.reference.trim() || null,
  notes: form.notes.trim() || null,
  items: selectedDeliveryLines(form).map((line) => ({ invoice_item_id: Number(line.invoice_item_id), delivered_quantity: String(line.delivered_quantity).trim() })),
})
export function validateDeliveryEmail(form) {
  const errors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.recipient_email || '').trim())) errors.recipient_email = 'Enter a valid recipient email.'
  if (String(form.recipient_name || '').length > 120) errors.recipient_name = 'Use 120 characters or fewer.'
  if (String(form.message || '').length > 1200) errors.message = 'Use 1,200 characters or fewer.'
  return errors
}
