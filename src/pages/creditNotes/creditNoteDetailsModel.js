import { creditNoteReasonLabel, creditNoteReferenceLabel, creditNoteStatusLabel } from '../../components/documents/labels'
import { invoiceMoney, validateInvoiceEmail } from '../invoices/invoiceDetailsModel'

export { creditNoteReasonLabel, creditNoteReferenceLabel, creditNoteStatusLabel, invoiceMoney }

export const creditNoteEditable = (note) => ['draft', 'rejected'].includes(note?.status)
export const creditNotePending = (note) => note?.status === 'pending_approval'
export const creditNoteApproved = (note) => note?.status === 'approved'

// Credit-note preflight responses are transient; unlike invoices, the PHP endpoint
// does NOT save the last validation to the credit-note record.
export function readCreditNoteReadiness(response) {
  const data = response?.data?.data
  if (!data || data.document_type !== 'credit_note' || !data.ubl_validation || typeof data.ubl_validation !== 'object') {
    throw new Error('The server did not return a credit-note UBL validation result.')
  }
  return data.ubl_validation
}

export function validateCreditNoteEmail(form) {
  return validateInvoiceEmail(form)
}

export function safeCreditNoteFilename(note) {
  return String(note?.credit_note_number || `credit-note-${note?.id || 'document'}`)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'credit-note'
}

export function creditNoteTone(status) {
  if (status === 'approved') return 'success'
  if (status === 'pending_approval') return 'warning'
  if (status === 'rejected' || status === 'void') return 'danger'
  return 'neutral'
}
