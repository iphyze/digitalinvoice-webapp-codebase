import { validatePassword, validateRequired } from '../../utils/validation'

export const EMPTY_PASSWORD = { current_password: '', password: '', password_confirmation: '' }

export const validateProfileName = (name) => {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return 'Full name is required.'
  if (Array.from(trimmed).length < 2 || Array.from(trimmed).length > 120) {
    return 'Full name must be between 2 and 120 characters.'
  }
  return ''
}

export const validateProfilePassword = (values, hasPassword) => {
  const failures = {
    current_password: hasPassword ? validateRequired(values.current_password, 'Current password') : '',
    password: validatePassword(values.password),
    password_confirmation: !values.password_confirmation
      ? 'Confirm your new password.'
      : values.password === values.password_confirmation ? '' : 'Passwords do not match.',
  }
  return Object.fromEntries(Object.entries(failures).filter(([, message]) => message))
}

export const parseProfile = (response) => {
  const data = response?.data?.data
  if (!data?.user || typeof data.user.has_password !== 'boolean' || !data.user.id) {
    throw new Error('Your profile could not be loaded completely. Try again.')
  }
  return {
    user: data.user,
    organization: data.organization || null,
    identities: Array.isArray(data.identities) ? data.identities : [],
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  }
}

export const roleLabel = (value) => String(value || 'Member')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase())
