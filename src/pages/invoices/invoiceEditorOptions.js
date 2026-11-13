/** Existing API choices from the legacy invoice editor; labels are not a UI design dependency. */
export const DISCOUNT_TYPES = [
  { value: 'none', label: 'No discount' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage' },
]
export const INVOICE_CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
]
export const FIRS_TRANSACTION_TYPES = [
  { value: 'b2b', label: 'B2B — Tax invoice' },
  { value: 'b2c', label: 'B2C — Simplified tax invoice' },
]
export const FIRS_DOCUMENT_TYPES = [
  { value: 'tax_invoice', label: 'Tax invoice' },
  { value: 'simplified_tax_invoice', label: 'Simplified tax invoice' },
]
export const FIRS_INVOICE_TYPES = [
  'commercial_invoice', 'credit_invoice', 'debit_note', 'self_billed_invoice',
  'factored_invoice', 'statement_of_account', 'purchase_order', 'proforma_invoice',
  'consignment_invoice', 'self_billed_credit_note', 'self_billed_debit_note',
  'credit_note_request', 'invoice_request', 'final_settlement', 'bill_of_lading',
  'waybill', 'shipping_instruction', 'certificate_of_origin',
  'customs_declaration', 'packing_list',
].map((value) => ({ value, label: value.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') }))
export const FIRS_PAYMENT_MEANS = [
  ['direct_transfer', 'Direct transfer'], ['bank_transfer', 'Bank transfer'],
  ['credit_transfer', 'Credit transfer'], ['card', 'Card payment'],
  ['cash', 'Cash'], ['cheque', 'Cheque'], ['mobile_money', 'Mobile money'],
  ['firs_pay_now', 'FIRS Pay-Now link'], ['other', 'Other recognized means'],
].map(([value, label]) => ({ value, label }))
export const suggestedFirsDocumentType = (transactionType) => transactionType === 'b2c' ? 'simplified_tax_invoice' : 'tax_invoice'
export const asResourceOptions = (resources = [], lower = false) => resources.map((entry) => ({
  value: lower ? String(entry.code || entry.value || '').toLowerCase() : String(entry.code || entry.value || ''),
  label: entry.label || entry.code || entry.value,
}))
