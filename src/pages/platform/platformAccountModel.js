import { validateProfileName, validateProfilePassword } from '../settings/profileModel'

export { validateProfileName, validateProfilePassword }

export const PLATFORM_SETTING_KEYS = [
  'platform_name', 'platform_tagline', 'public_site_url', 'owner_email', 'support_email',
  'billing_email', 'compliance_email', 'platform_phone', 'default_country',
  'default_currency', 'default_billing_interval', 'trial_days', 'grace_period_days',
  'expiry_warning_days', 'auto_suspend_expired', 'send_expiry_reminders', 'paystack_mode',
  'paystack_public_key', 'default_vat_rate', 'compliance_environment',
]

export const DEFAULT_PLATFORM_SETTINGS = {
  platform_name: 'DigitalInvoice', platform_tagline: '', public_site_url: '', owner_email: '',
  support_email: '', billing_email: '', compliance_email: '', platform_phone: '',
  default_country: 'NG', default_currency: 'NGN', default_billing_interval: 'monthly',
  trial_days: '0', grace_period_days: '0', expiry_warning_days: '14',
  auto_suspend_expired: true, send_expiry_reminders: true, paystack_mode: 'test',
  paystack_public_key: '', default_vat_rate: '7.50', compliance_environment: 'sandbox',
}

const truthy = (value) => value === true || value === 1 || value === '1' || value === 'true'
const boolKeys = new Set(['auto_suspend_expired', 'send_expiry_reminders'])

export function parsePlatformProfile(response) {
  const data = response?.data?.data
  if (!data?.user?.id || typeof data.user.has_password !== 'boolean' || !data.platform?.role || !data.organization) {
    throw new Error('Platform profile information is incomplete. Please refresh.')
  }
  return {
    user: data.user,
    organization: data.organization,
    platform: data.platform,
    identities: Array.isArray(data.identities) ? data.identities : [],
  }
}

export function parsePlatformSettings(response) {
  const data = response?.data?.data
  if (!data || typeof data.settings !== 'object' || !data.settings || !data.gateway || !data.summary) {
    throw new Error('Platform settings could not be loaded completely. Please refresh.')
  }
  return data
}

export function normalizePlatformSettings(settings) {
  const result = { ...DEFAULT_PLATFORM_SETTINGS }
  for (const key of PLATFORM_SETTING_KEYS) {
    if (settings && Object.prototype.hasOwnProperty.call(settings, key) && settings[key] != null) {
      result[key] = boolKeys.has(key) ? truthy(settings[key]) : String(settings[key])
    }
  }
  return result
}

export function validatePlatformSettings(values) {
  const errors = {}
  const set = (key, message) => { if (message) errors[key] = message }
  const str = (key) => String(values?.[key] ?? '').trim()
  const max = (key, n, required = false) => {
    const val = str(key)
    set(key, required && !val ? 'This field is required.' : Array.from(val).length > n ? `Maximum ${n} characters.` : '')
  }
  max('platform_name', 120, true)
  max('platform_tagline', 190)
  max('platform_phone', 40)
  max('paystack_public_key', 190)
  max('public_site_url', 190)
  if (!errors.public_site_url && str('public_site_url')) {
    try { const url = new URL(str('public_site_url')); set('public_site_url', !['http:', 'https:'].includes(url.protocol) ? 'Enter an HTTP(S) address.' : '') }
    catch { set('public_site_url', 'Enter a valid website address.') }
  }
  for (const key of ['owner_email', 'support_email', 'billing_email', 'compliance_email']) {
    const email = str(key)
    set(key, email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address (maximum 190 characters).' : '')
  }
  set('default_country', /^[A-Z]{2}$/.test(str('default_country').toUpperCase()) ? '' : 'Enter a two-letter country code.')
  set('default_currency', /^[A-Z]{3}$/.test(str('default_currency').toUpperCase()) ? '' : 'Enter a three-letter currency code.')
  const options = {
    default_billing_interval: ['monthly', 'quarterly', 'biannually', 'annually'],
    paystack_mode: ['test', 'live'], compliance_environment: ['sandbox', 'production'],
  }
  for (const [key, allowed] of Object.entries(options)) set(key, allowed.includes(str(key)) ? '' : 'Select a valid option.')
  for (const [key, min, maxValue] of [
    ['trial_days', 0, 365], ['grace_period_days', 0, 90], ['expiry_warning_days', 1, 90],
  ]) {
    const value = str(key)
    set(key, /^\d+$/.test(value) && Number(value) >= min && Number(value) <= maxValue
      ? '' : `Enter a whole number between ${min} and ${maxValue}.`)
  }
  const vat = str('default_vat_rate')
  set('default_vat_rate', /^\d+(?:\.\d+)?$/.test(vat) && Number(vat) >= 0 && Number(vat) <= 100
    ? '' : 'Enter a VAT rate between 0 and 100.')
  return errors
}

export function buildPlatformSettingsPayload(values) {
  const settings = {}
  for (const key of PLATFORM_SETTING_KEYS) {
    if (boolKeys.has(key)) settings[key] = values[key] ? '1' : '0'
    else settings[key] = String(values[key] ?? '').trim()
  }
  settings.default_country = settings.default_country.toUpperCase()
  settings.default_currency = settings.default_currency.toUpperCase()
  return { settings }
}
