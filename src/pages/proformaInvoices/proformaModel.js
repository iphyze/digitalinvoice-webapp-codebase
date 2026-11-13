import { format } from 'date-fns'

export const PROFORMA_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'converted', label: 'Converted' },
]

export const proformaReference = (record) => record?.proforma_number || `Draft #${record?.id || '—'}`
export const proformaStatusLabel = (status) => PROFORMA_STATUSES.find((entry) => entry.value === status)?.label || String(status || 'Unknown')
export const proformaStatusTone = (status) => ({ draft: 'neutral', issued: 'success', converted: 'info' }[status] || 'neutral')
export const proformaEditable = (record) => record?.status === 'draft' && !record?.archived_at
export const proformaIssued = (record) => ['issued', 'converted'].includes(record?.status) && !record?.archived_at
export const proformaFilename = (record) => String(record?.proforma_number || `proforma-${record?.id || 'document'}`).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'proforma'

export const proformaCollection = (response) => {
  const data = response?.data?.data || {}
  return {
    records: Array.isArray(data.proformas) ? data.proformas : [],
    pagination: data.pagination || { page: 1, limit: 10, total: 0, total_pages: 0 },
  }
}

let lineSequence = 0
export const blankProformaLine = () => ({
  key: `proforma-line-${++lineSequence}`,
  item_id: '', description: '', quantity: '1', unit_price: '',
  discount_type: 'none', discount_value: '0', tax_rate_id: '',
})
export const initialProforma = () => ({
  customer_id: '', issue_date: format(new Date(), 'yyyy-MM-dd'), expiry_date: '', currency: 'NGN',
  subject: '', reference: '', bank_account_id: '', discount_type: 'none', discount_value: '0',
  notes: '', terms_and_conditions: '', footer_note: '', payment_instructions: '',
  items: [blankProformaLine()],
})
export const fromProforma = (record) => ({
  ...initialProforma(),
  customer_id: String(record?.customer_id || ''),
  issue_date: record?.issue_date || '', expiry_date: record?.expiry_date || '',
  currency: record?.currency || 'NGN', subject: record?.subject || '', reference: record?.reference || '',
  bank_account_id: String(record?.bank_account_id || ''),
  discount_type: record?.discount_type || 'none', discount_value: String(record?.discount_value ?? 0),
  notes: record?.notes || '', terms_and_conditions: record?.terms_and_conditions || '',
  footer_note: record?.footer_note || '', payment_instructions: record?.payment_instructions || '',
  items: Array.isArray(record?.items) && record.items.length ? record.items.map((item) => ({
    key: `saved-proforma-${item.id || ++lineSequence}-${++lineSequence}`,
    item_id: String(item.item_id || ''), description: item.item_description_snapshot || '',
    quantity: String(item.quantity ?? 1), unit_price: String(item.unit_price ?? ''),
    discount_type: item.discount_type || 'none', discount_value: String(item.discount_value ?? 0),
    tax_rate_id: String(item.tax_rate_id || ''),
  })) : [blankProformaLine()],
})

const numeric = (value) => String(value ?? '').replaceAll(',', '').trim()
const decimal = (value, places) => {
  const string = numeric(value)
  if (!/^\d+(?:\.\d+)?$/.test(string) || !Number.isFinite(Number(string))) return false
  const digits = string.split('.')[1]?.length || 0
  return digits <= places
}
const maxDiscount = (type, value, key, errors) => {
  if (type === 'none') return
  if (!decimal(value, 2) || Number(numeric(value)) < 0 || (type === 'percentage' && Number(numeric(value)) > 100)) {
    errors[key] = 'Enter a valid discount (up to 2 decimal places).'
  }
}
export const validateProforma = (form, items = [], taxRates = [], accounts = []) => {
  const errors = {}
  if (!form.customer_id) errors.customer_id = 'Select a customer.'
  if (!form.currency) errors.currency = 'Select a currency.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.issue_date || '')) errors.issue_date = 'Select an issue date.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expiry_date || '')) errors.expiry_date = 'Select an expiry date.'
  else if (form.issue_date && form.expiry_date < form.issue_date) errors.expiry_date = 'Expiry date cannot be earlier than the issue date.'
  if (form.subject.length > 180) errors.subject = 'Subject must be 180 characters or less.'
  if (form.reference.length > 100) errors.reference = 'Reference must be 100 characters or less.'
  for (const [field, max] of [['notes', 5000], ['terms_and_conditions', 5000], ['footer_note', 2000], ['payment_instructions', 3000]]) {
    if (form[field]?.length > max) errors[field] = `Maximum ${max} characters.`
  }
  if (form.bank_account_id && !accounts.some((a) => String(a.id) === String(form.bank_account_id) && a.currency === form.currency && Number(a.is_active))) {
    errors.bank_account_id = 'Select an active payment account for this currency.'
  }
  if (!form.items.length) errors.items = 'Add at least one product or service.'
  form.items.forEach((line, index) => {
    const key = (field) => `items.${index}.${field}`
    const item = items.find((entry) => String(entry.id) === String(line.item_id) && entry.currency === form.currency)
    if (!item) errors[key('item_id')] = 'Select an active product or service in this currency.'
    if (!decimal(line.quantity, 4) || Number(numeric(line.quantity)) <= 0) errors[key('quantity')] = 'Enter a positive quantity (up to 4 decimal places).'
    if (!decimal(line.unit_price, 2)) errors[key('unit_price')] = 'Enter a valid unit price (up to 2 decimal places).'
    if (!taxRates.some((rate) => String(rate.id) === String(line.tax_rate_id))) errors[key('tax_rate_id')] = 'Select a tax treatment.'
    if (line.description?.length > 2000) errors[key('description')] = 'Description must be 2000 characters or less.'
    if (line.discount_type !== 'none' && !Number(item?.discount_allowed)) errors[key('discount_type')] = 'Discount is not allowed for this item.'
    maxDiscount(line.discount_type, line.discount_value, key('discount_value'), errors)
  })
  maxDiscount(form.discount_type, form.discount_value, 'discount_value', errors)
  return errors
}

export const proformaPayload = (form, action = 'draft', id) => ({
  ...(id ? { id: Number(id) } : {}),
  save_action: action,
  customer_id: Number(form.customer_id), issue_date: form.issue_date, expiry_date: form.expiry_date,
  currency: form.currency, subject: form.subject.trim() || null, reference: form.reference.trim() || null,
  bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
  discount_type: form.discount_type, discount_value: form.discount_type === 'none' ? '0' : numeric(form.discount_value),
  notes: form.notes.trim() || null, terms_and_conditions: form.terms_and_conditions.trim() || null,
  footer_note: form.footer_note.trim() || null, payment_instructions: form.payment_instructions.trim() || null,
  items: form.items.map((line) => ({
    item_id: Number(line.item_id), description: line.description.trim() || null,
    quantity: numeric(line.quantity), unit_price: numeric(line.unit_price),
    discount_type: line.discount_type, discount_value: line.discount_type === 'none' ? '0' : numeric(line.discount_value),
    tax_rate_id: Number(line.tax_rate_id),
  })),
})
export const savedProformaId = (response) => {
  const record = response?.data?.data?.proforma || response?.data?.proforma
  return Number(record?.id || 0)
}
export const validateProformaEmail = ({ recipient_email = '', recipient_name = '', message = '' }) => {
  const errors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email.trim())) errors.recipient_email = 'Enter a valid recipient email.'
  if (recipient_name.trim().length > 120) errors.recipient_name = 'Recipient name must be 120 characters or less.'
  if (message.trim().length > 1200) errors.message = 'Message must be 1200 characters or less.'
  return errors
}
