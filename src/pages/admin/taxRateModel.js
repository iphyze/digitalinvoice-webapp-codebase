export const TAX_TREATMENTS = [
  { value: 'standard', label: 'Standard rated' },
  { value: 'zero_rated', label: 'Zero rated' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'non_taxable', label: 'Non-taxable' },
]
export const blankTaxRate = { code: '', name: '', description: '', treatment: 'standard', rate_percent: '7.5', is_default: false, is_active: true }
export const asBoolean = (v) => v === true || v === 1 || v === '1'

/** A display-only rate: preserve the backend's up-to-four-decimal input precision. */
export const formatTaxRatePercent = (value) => {
  if (value == null || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toFixed(2)}%` : '—'
}
export const taxRateForm = (item) => item ? {
  id: Number(item.id), code: item.code || '', name: item.name || '', description: item.description || '',
  treatment: item.treatment || 'standard', rate_percent: String(item.rate_percent ?? '0'),
  is_default: asBoolean(item.is_default), is_active: asBoolean(item.is_active),
} : { ...blankTaxRate }
export const validateTaxRate = (form) => {
  const errors = {}
  const code = String(form.code || '').trim()
  const name = String(form.name || '').trim()
  const description = String(form.description || '').trim()
  const rate = String(form.rate_percent ?? '').trim()
  if (!code || code.length > 40 || !/^[A-Za-z0-9._\/-]+$/.test(code)) errors.code = 'Use 1–40 letters, digits, dots, slashes, underscores or hyphens.'
  if (!name || name.length > 100) errors.name = 'Name is required (up to 100 characters).'
  if (description.length > 255) errors.description = 'Description cannot exceed 255 characters.'
  if (!TAX_TREATMENTS.some((item) => item.value === form.treatment)) errors.treatment = 'Choose a valid tax treatment.'
  // PHP's catalogueRatePercent rejects negative, >100 and >4 decimal places.
  if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(rate) || Number(rate) > 100) errors.rate_percent = 'Enter a percentage from 0 to 100 (up to four decimals).'
  if (form.treatment !== 'standard' && Number(rate) !== 0) errors.rate_percent = 'This treatment must use a 0% rate.'
  if (form.is_default && !form.is_active) errors.is_default = 'An inactive rate cannot be the default.'
  return errors
}
export const taxRatePayload = (form) => ({
  ...(form.id ? { id: form.id } : {}),
  code: form.code.trim(), name: form.name.trim(), description: form.description.trim() || null,
  treatment: form.treatment, rate_percent: form.rate_percent, is_default: Boolean(form.is_default), is_active: Boolean(form.is_active),
})
