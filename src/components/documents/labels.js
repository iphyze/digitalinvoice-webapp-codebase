// Document labels carried over unchanged from the previous app's option files.
export const invoiceStatusLabel = (status) => ({
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', rejected: 'Returned for correction', void: 'Void',
}[status] || status || 'Unknown')

export const paymentStatusLabel = (status) => ({
  unpaid: 'Unpaid', partially_paid: 'Partially paid', paid: 'Paid',
}[status] || status || 'Not settled')

export const nrsStatusLabel = (status) => ({
  not_submitted: 'Internal only', pending: 'Submission pending', accepted: 'Accepted', rejected: 'Rejected', failed: 'Submission failed',
}[status] || status || 'Internal only')

export const CREDIT_NOTE_REASON_CATEGORIES = [
  { value: 'return', label: 'Returned goods/service' },
  { value: 'billing_error', label: 'Billing correction' },
  { value: 'discount', label: 'Discount after invoice' },
  { value: 'cancellation', label: 'Cancelled service' },
  { value: 'other', label: 'Other adjustment' },
]
export const creditNoteStatusLabel = (status) => ({
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', rejected: 'Returned', void: 'Void',
}[status] || 'Unknown')
export const creditNoteReasonLabel = (reason) => CREDIT_NOTE_REASON_CATEGORIES.find((item) => item.value === reason)?.label || 'Other adjustment'
export const creditNoteReferenceLabel = (creditNote) => creditNote?.credit_note_number || `Draft CN-${String(creditNote?.id || '').padStart(5, '0')}`

export const paymentMethodOptions = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS terminal' },
  { value: 'card', label: 'Card payment' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other method' },
]
export const paymentMethodLabel = (method) => paymentMethodOptions.find((o) => o.value === method)?.label || method || '—'
