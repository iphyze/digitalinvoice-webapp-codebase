export const ITEM_TYPES = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
];

export const ITEM_STATUS_OPTIONS = [
  { value: 'active', label: 'Active records' },
  { value: 'inactive', label: 'Inactive records' },
  { value: 'archived', label: 'Archived records' },
  { value: 'all', label: 'All records' },
];

export const ITEM_CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
];

export const TAX_TREATMENTS = [
  { value: 'standard', label: 'Standard VAT' },
  { value: 'zero_rated', label: 'Zero rated' },
  { value: 'exempt', label: 'VAT exempt' },
  { value: 'non_taxable', label: 'Non-taxable' },
];

export const itemTypeLabel = (value) => ITEM_TYPES.find((option) => option.value === value)?.label || 'Item';
export const treatmentLabel = (value) => TAX_TREATMENTS.find((option) => option.value === value)?.label || value || '—';

export const taxRateOptionLabel = (taxRate) => {
  const rate = Number(taxRate.rate_percent || 0).toFixed(2).replace(/\.00$/, '');
  return `${taxRate.name} — ${rate}%`;
};

export const unitOptionLabel = (unit) => `${unit.name}${unit.symbol ? ` (${unit.symbol})` : ''}${Number(unit.is_custom) ? ' — Workspace unit' : ''}`;
