// Kept in sync with the original invoice workflow and existing PHP API values.
export const INVOICE_STATUSES = [
  { value: 'all', label: 'All invoices' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned for correction' },
  { value: 'void', label: 'Void' },
]

export const FIRS_READINESS_OPTIONS = [
  { value: 'all', label: 'All FIRS readiness' },
  { value: 'not_checked', label: 'Not checked' },
  { value: 'ready', label: 'Ready' },
  { value: 'blocked', label: 'Needs attention' },
]

export const statusLabel = (value) => ({
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved',
  rejected: 'Returned for correction', void: 'Void',
}[value] || value || 'Unknown')

export const paymentStatusLabel = (value) => ({
  unpaid: 'Unpaid', partially_paid: 'Partially paid', paid: 'Paid',
}[value] || value || 'Not settled')

export const readinessLabel = (value) => ({
  ready: 'FIRS ready', blocked: 'Needs attention', not_checked: 'Not checked',
}[value] || 'Not checked')

export const invoiceReferenceLabel = (invoice) => invoice.invoice_number || `Draft #${invoice.id}`

export const statusTone = (value) => ({
  draft: 'neutral', pending_approval: 'warning', approved: 'success',
  rejected: 'danger', void: 'danger',
}[value] || 'neutral')

export const readinessTone = (value) => ({
  ready: 'success', blocked: 'danger', not_checked: 'neutral',
}[value] || 'neutral')
