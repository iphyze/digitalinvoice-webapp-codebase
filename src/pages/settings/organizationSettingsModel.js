/** Organization API form models keep the server-owned/read-only fields out of writes. */
const str = (value) => value == null ? '' : String(value)
const bool = (value) => value === true || value === 1 || value === '1'

export const BUSINESS_TYPES = [
  { value: 'limited_company', label: 'Limited company' },
  { value: 'business_name', label: 'Registered business name' },
  { value: 'sole_proprietorship', label: 'Sole proprietorship' },
  { value: 'ngo', label: 'NGO / Incorporated trustee' },
  { value: 'government', label: 'Government organisation' },
  { value: 'other', label: 'Other' },
]
export const ISSUER_TYPES = [
  { value: 'corporate', label: 'Corporate organisation' },
  { value: 'business_name', label: 'Registered business name' },
  { value: 'ngo', label: 'NGO / Non-profit organisation' },
  { value: 'government', label: 'Government organisation' },
  { value: 'individual', label: 'Individual issuer' },
  { value: 'other', label: 'Other issuer' },
]
export const REGISTRATION_TYPES = [
  { value: 'cac_rc', label: 'CAC RC — Registered company' },
  { value: 'cac_bn', label: 'CAC BN — Business name' },
  { value: 'incorporated_trustee', label: 'Incorporated trustee' },
  { value: 'government', label: 'Government entity' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'other', label: 'Other' },
]
export const COUNTRIES = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
]
export const CURRENCIES = [
  { value: 'NGN', label: 'Nigerian Naira (NGN)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]
const BUSINESS_KEYS = [
  'registered_business_name', 'trading_name', 'business_email', 'phone',
  'business_type', 'cac_registration_number', 'industry', 'website',
  'address_line_1', 'address_line_2', 'city', 'state', 'country',
]
const INVOICE_KEYS = [
  'invoice_prefix', 'invoice_start_number', 'default_currency', 'vat_enabled',
  'default_vat_rate', 'default_payment_terms_days', 'invoice_footer_note',
  'payment_instructions', 'enable_pay_now_by_default', 'firs_default_transaction_type',
  'firs_default_document_type', 'firs_default_invoice_type_code',
  'firs_default_payment_means_code', 'firs_default_tax_category_code',
  'firs_default_vat_exemption_code', 'firs_auto_readiness_check',
]
const COMPLIANCE_KEYS = [
  'tax_identification_number', 'issuer_type', 'business_registration_type',
  'is_vat_registered', 'vat_number', 'compliance_confirmed',
  'nrs_business_id', 'nrs_service_id', 'nrs_postal_zone', 'nrs_state_code', 'nrs_lga_code',
]
const BUSINESS_DEFAULTS = { business_type: 'limited_company', country: 'NG' }
const INVOICE_DEFAULTS = {
  invoice_prefix: 'INV', invoice_start_number: '1', default_currency: 'NGN',
  vat_enabled: true, default_vat_rate: '7.50', default_payment_terms_days: '30',
  enable_pay_now_by_default: false, firs_default_transaction_type: 'b2b',
  firs_default_document_type: 'tax_invoice', firs_default_invoice_type_code: 'commercial_invoice',
  firs_default_payment_means_code: 'direct_transfer', firs_default_tax_category_code: 'VAT_STANDARD',
  firs_auto_readiness_check: false,
}
const COMPLIANCE_DEFAULTS = { issuer_type: 'corporate', business_registration_type: 'cac_rc', is_vat_registered: false }
const typedValues = (keys, source, defaults) => Object.fromEntries(keys.map((key) => [
  key, ['vat_enabled', 'enable_pay_now_by_default', 'firs_auto_readiness_check', 'is_vat_registered', 'compliance_confirmed'].includes(key)
    ? bool(source[key] ?? defaults[key]) : str(source[key] ?? defaults[key]),
]))

export const businessForm = (profile = {}, organization = {}) => ({
  ...typedValues(BUSINESS_KEYS, profile, BUSINESS_DEFAULTS),
  registered_business_name: str(profile.registered_business_name || profile.name || organization.name),
})
export const invoiceForm = (settings = {}) => typedValues(INVOICE_KEYS, settings, INVOICE_DEFAULTS)
export const complianceForm = (profile = {}) => ({
  ...typedValues(COMPLIANCE_KEYS, profile, COMPLIANCE_DEFAULTS),
  compliance_confirmed: Boolean(profile.compliance_confirmed_at),
})

export const invoicePayload = (form) => ({
  ...form,
  invoice_prefix: form.invoice_prefix.trim().toUpperCase(),
  invoice_start_number: Number(form.invoice_start_number),
  default_vat_rate: form.vat_enabled ? Number(form.default_vat_rate) : 0,
  default_payment_terms_days: Number(form.default_payment_terms_days),
})

export const resourceOptions = (entries = [], fallback, normalize = (v) => v) => {
  const options = (Array.isArray(entries) ? entries : []).map((item) => ({
    value: normalize(str(item.code || item.value)), label: item.label || item.code || item.value,
  })).filter((item) => item.value)
  if (fallback && !options.some((item) => item.value === fallback.value)) options.unshift(fallback)
  return options
}
