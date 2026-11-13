// Options retained from the previous customer workflow (business values are API contracts).
export const CUSTOMER_TYPES = [
  { value: 'business', label: 'Business customer' },
  { value: 'individual', label: 'Individual customer' },
  { value: 'government', label: 'Government / institution' },
  { value: 'international', label: 'International customer' },
]
export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active customers' },
  { value: 'inactive', label: 'Inactive customers' },
  { value: 'archived', label: 'Archived customers' },
  { value: 'all', label: 'All customers' },
]
export const CUSTOMER_CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — United States Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
]
export const CUSTOMER_COUNTRIES = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
]
export const typeLabel = (type) => CUSTOMER_TYPES.find((option) => option.value === type)?.label || type || '—'
export const countryLabel = (code) => CUSTOMER_COUNTRIES.find((option) => option.value === code)?.label || code || '—'
