/**
 * Read-only NRS/MBS platform integration helpers.
 * These describe *local configuration/readiness*, not regulatory approval.
 */
export const FIRS_STATUSES = [
  { value: 'not_licensed', label: 'Not licensed' },
  { value: 'license_pending', label: 'Licence pending' },
  { value: 'licensed', label: 'Licence recorded (internal)' },
  { value: 'sandbox_ready', label: 'Sandbox ready (internal)' },
  { value: 'production_ready', label: 'Production ready (internal)' },
  { value: 'suspended', label: 'Suspended' },
]

export const FIRS_ENVIRONMENTS = [
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'production', label: 'Production (transport unavailable)' },
]

export const FIRS_FIELDS = [
  'firs_integration_status',
  'firs_environment',
  'firs_sandbox_enabled',
  'firs_base_url',
  'firs_merchant_id',
  'firs_access_point_provider',
  'firs_notes',
]

const DEFAULTS = {
  firs_integration_status: 'not_licensed',
  firs_environment: 'sandbox',
  firs_sandbox_enabled: '0',
  firs_base_url: '',
  firs_merchant_id: '',
  firs_access_point_provider: '',
  firs_notes: '',
}
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const asText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''

export function parseFirsOverview(response) {
  const data = response?.data?.data
  if (!isObject(data) || !isObject(data.settings) || !isObject(data.settings.settings)) {
    throw new Error('Unexpected NRS integration response. Please refresh or contact support.')
  }
  return {
    settings: data.settings,
    summary: isObject(data.summary) ? data.summary : {},
    resources: Array.isArray(data.resources) ? data.resources : [],
    recent_logs: Array.isArray(data.recent_logs) ? data.recent_logs : [],
  }
}

export function normalizeFirsForm(settings = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [
    key,
    key === 'firs_sandbox_enabled'
      ? (settings[key] === true || settings[key] === 1 || ['1', 'true', 'yes', 'on'].includes(String(settings[key]).toLowerCase()) ? '1' : '0')
      : asText(settings[key] ?? fallback),
  ]))
}

export function buildFirsPatch(form, saved, credentials = {}) {
  const changes = {}
  for (const key of FIRS_FIELDS) {
    if (form[key] !== saved[key]) changes[key] = form[key]
  }
  // Never echo the backend's ******** sentinel, or send an empty password as
  // an implicit credential deletion. Only newly entered credentials are sent.
  if (credentials.apiKey?.trim()) changes.firs_api_key = credentials.apiKey.trim()
  if (credentials.secretKey?.trim()) changes.firs_secret_key = credentials.secretKey.trim()
  return changes
}

export function validateFirsForm(form, credentials = {}) {
  const errors = {}
  if (!FIRS_STATUSES.some((status) => status.value === form.firs_integration_status)) {
    errors.firs_integration_status = 'Select a valid internal integration status.'
  }
  if (!FIRS_ENVIRONMENTS.some((option) => option.value === form.firs_environment)) {
    errors.firs_environment = 'Select an environment.'
  }
  if (form.firs_base_url?.trim()) {
    try {
      const url = new URL(form.firs_base_url)
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    } catch { errors.firs_base_url = 'Enter a complete http(s) endpoint URL.' }
  }
  if (String(form.firs_notes || '').length > 4000) errors.firs_notes = 'Keep internal notes within 4,000 characters.'
  if (String(credentials.apiKey || '').length > 4000) errors.apiKey = 'The API key is too long.'
  if (String(credentials.secretKey || '').length > 4000) errors.secretKey = 'The secret key is too long.'
  return errors
}

export function entriesToResourceText(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const fields = [entry.code || entry.value || '', entry.label || entry.name || '', entry.description || '']
    if (entry.active === false || entry.active === 0) fields.push('inactive')
    return fields.join(' | ')
  }).join('\n')
}

export function parseResourceText(source) {
  const rows = String(source || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!rows.length) throw new Error('Add at least one resource entry.')
  if (rows.length > 300) throw new Error('A resource catalogue cannot contain more than 300 entries.')
  const seen = new Set()
  return rows.map((line, index) => {
    const [rawCode = '', rawLabel = '', rawDescription = '', rawStatus = 'active', ...rest] = line.split('|').map((part) => part.trim())
    if (rest.length) throw new Error(`Line ${index + 1}: use CODE | Label | Description | active/inactive.`)
    const code = rawCode.toUpperCase()
    if (!code) throw new Error(`Line ${index + 1}: a code is required.`)
    if (seen.has(code)) throw new Error(`Duplicate resource code: ${code}.`)
    if (rawStatus && !['active', 'inactive', 'true', 'false', '1', '0'].includes(rawStatus.toLowerCase())) {
      throw new Error(`Line ${index + 1}: status must be active or inactive.`)
    }
    seen.add(code)
    return { code, label: rawLabel || code, description: rawDescription || null,
      active: !['inactive', 'false', '0'].includes(rawStatus.toLowerCase()) }
  })
}

export function localDateTime(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 19)
}
