import { format } from 'date-fns'
import { CREDIT_NOTE_REASON_CATEGORIES } from '../../components/documents/labels'

export { CREDIT_NOTE_REASON_CATEGORIES }

export const CREDIT_NOTE_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned' },
  { value: 'void', label: 'Void' },
]

export const blankCreditNote = () => ({
  invoice_id: '', credit_note_date: format(new Date(), 'yyyy-MM-dd'),
  reason_category: 'billing_error', reason: '', external_reference: '', notes: '', items: [],
})

export const fromCreditNote = (note) => ({
  invoice_id: String(note.invoice_id || ''),
  credit_note_date: note.credit_note_date || format(new Date(), 'yyyy-MM-dd'),
  reason_category: note.reason_category || 'billing_error',
  reason: note.reason || '', external_reference: note.external_reference || '',
  notes: note.notes || '',
  items: (note.items || []).map((line) => ({
    invoice_item_id: String(line.invoice_item_id),
    quantity: String(line.quantity ?? ''), selected: true,
  })),
})

export function mergeCreditLines(availableLines, previousLines = []) {
  const previous = new Map(previousLines.map((line) => [String(line.invoice_item_id), line]))
  return (availableLines || []).map((line) => ({
    invoice_item_id: String(line.invoice_item_id),
    quantity: previous.get(String(line.invoice_item_id))?.quantity ?? '',
    selected: Boolean(previous.get(String(line.invoice_item_id))?.selected),
  }))
}

export function selectedCreditLines(form) {
  return (form.items || []).filter((line) => line.selected)
}

// The backend prorates original invoice monetary components individually in minor
// units. This estimate is deliberately NOT described as a server-verified total.
export function estimateCredit(form, source) {
  const lines = new Map((source?.creditable_items || []).map((line) => [String(line.invoice_item_id), line]))
  const items = selectedCreditLines(form)
  const total = items.reduce((sum, selection) => {
    const line = lines.get(String(selection.invoice_item_id))
    const quantity = Number(String(selection.quantity || '').trim())
    const remaining = Number(line?.remaining_quantity || 0)
    if (!line || !Number.isFinite(quantity) || quantity <= 0 || remaining <= 0) return sum
    return sum + (Number(line.remaining_total_amount || 0) * (Math.min(quantity, remaining) / remaining))
  }, 0)
  return { count: items.length, total }
}

const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function validateCreditNoteForm(form, source) {
  const errors = {}
  const invoice = source?.invoice
  if (!form.invoice_id || !invoice || String(invoice.id) !== String(form.invoice_id)) {
    errors.invoice_id = 'Select a valid approved source invoice.'
  }
  if (!validDate(form.credit_note_date)) errors.credit_note_date = 'Select a valid credit note date.'
  else if (invoice?.invoice_date && form.credit_note_date < invoice.invoice_date) {
    errors.credit_note_date = 'Credit note date cannot be earlier than the invoice date.'
  }
  if (!CREDIT_NOTE_REASON_CATEGORIES.some((entry) => entry.value === form.reason_category)) {
    errors.reason_category = 'Select a valid credit note reason category.'
  }
  const reasonLength = Array.from(form.reason.trim()).length
  if (reasonLength < 5 || reasonLength > 500) errors.reason = 'Enter a clear reason between 5 and 500 characters.'
  if (Array.from(form.external_reference.trim()).length > 120) errors.external_reference = 'Use 120 characters or fewer.'
  if (Array.from(form.notes.trim()).length > 2000) errors.notes = 'Use 2,000 characters or fewer.'
  const lines = new Map((source?.creditable_items || []).map((line) => [String(line.invoice_item_id), line]))
  const selected = selectedCreditLines(form)
  if (!selected.length || selected.length > 100) errors.items = 'Select between 1 and 100 invoice lines to credit.'
  selected.forEach((selection) => {
    const line = lines.get(String(selection.invoice_item_id))
    const text = String(selection.quantity ?? '').trim()
    const quantity = Number(text)
    const remaining = Number(line?.remaining_quantity || 0)
    // The PHP route accepts DECIMAL(4) precision and quantities up to 10,000.
    if (!line || !/^(?:\d+)(?:\.\d{1,4})?$/.test(text) || !Number.isFinite(quantity) ||
      quantity <= 0 || quantity > 10000 || quantity > remaining + 0.00000001) {
      errors[`quantity.${selection.invoice_item_id}`] = 'Enter a positive quantity, up to the remaining amount (4 decimal places max).'
    }
  })
  if (selected.length && Object.keys(errors).every((key) => !key.startsWith('quantity.'))) {
    if (estimateCredit(form, source).total <= 0) errors.items = 'The credit amount must be greater than zero.'
  }
  return errors
}

export function creditNotePayload(form, id) {
  return {
    ...(id ? { id: Number(id) } : {}),
    invoice_id: Number(form.invoice_id),
    credit_note_date: form.credit_note_date,
    reason_category: form.reason_category,
    reason: form.reason.trim(),
    external_reference: form.external_reference.trim() || null,
    notes: form.notes.trim() || null,
    items: selectedCreditLines(form).map((line) => ({
      invoice_item_id: Number(line.invoice_item_id),
      quantity: String(line.quantity).trim(),
    })),
  }
}

export const creditNoteCollection = (response) => {
  const data = response?.data?.data || response?.data || {}
  return {
    notes: Array.isArray(data.credit_notes) ? data.credit_notes : [],
    pagination: data.pagination || { total: 0, total_pages: 0 },
  }
}

export const creditNoteRecord = (response) => response?.data?.data?.credit_note || response?.data?.credit_note || null
export const creditNoteSavedId = (response) => Number(creditNoteRecord(response)?.id || response?.data?.data?.credit_note_id || response?.data?.credit_note_id || 0)
