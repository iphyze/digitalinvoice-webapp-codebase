const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{8,20}$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const valueOf = (value) => String(value ?? '').trim();

export const validateRequired = (value, label) => (
  valueOf(value) ? '' : `${label} is required.`
);

export const validateEmail = (value, label = 'Email address') => {
  const requiredError = validateRequired(value, label);
  if (requiredError) return requiredError;
  return emailPattern.test(valueOf(value)) ? '' : 'Enter a valid email address.';
};

export const validatePhone = (value) => {
  if (!valueOf(value)) return '';
  return phonePattern.test(valueOf(value)) ? '' : 'Enter a valid phone number.';
};

export const validatePassword = (value) => {
  const requiredError = validateRequired(value, 'Password');
  if (requiredError) return requiredError;
  return passwordPattern.test(String(value))
    ? ''
    : 'Use at least 8 characters, one uppercase letter, one number and one special character.';
};

export const getPasswordChecks = (value = '') => ({
  length: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

const compact = (entries) => Object.fromEntries(entries.filter(([, message]) => Boolean(message)));

export const validateLoginForm = (form) => compact([
  ['email', validateEmail(form.email)],
  ['password', validateRequired(form.password, 'Password')],
]);

export const validateRegistrationForm = (form) => compact([
  ['name', validateRequired(form.name, 'Full name') ||
    ([...valueOf(form.name)].length > 120 ? 'Full name must be 120 characters or fewer.' : '')],
  ['organization_name', validateRequired(form.organization_name, 'Business name') ||
    ([...valueOf(form.organization_name)].length > 180 ? 'Business name must be 180 characters or fewer.' : '')],
  ['email', validateEmail(form.email, 'Business email')],
  ['password', validatePassword(form.password)],
  ['password_confirmation', !valueOf(form.password_confirmation)
    ? 'Confirm your password.'
    : form.password !== form.password_confirmation
      ? 'Passwords do not match.'
      : ''],
]);

export const validateDemoForm = (form) => compact([
  ['name', validateRequired(form.name, 'Your name')],
  ['email', validateEmail(form.email, 'Business email')],
  ['company_name', validateRequired(form.company_name, 'Company name')],
  ['phone', validatePhone(form.phone)],
]);

export const validateForgotPasswordForm = (email) => compact([
  ['email', validateEmail(email)],
]);

export const validateResetPasswordForm = (form, token) => compact([
  ['token', token ? '' : 'The reset token is missing or invalid.'],
  ['password', validatePassword(form.password)],
  ['password_confirmation', !valueOf(form.password_confirmation)
    ? 'Confirm your new password.'
    : form.password !== form.password_confirmation
      ? 'Passwords do not match.'
      : ''],
]);

export const validateInvitationForm = (form, token) => compact([
  ['token', token ? '' : 'The invitation link is missing its token.'],
  ['name', validateRequired(form.name, 'Your name') ||
    ([...valueOf(form.name)].length > 120 ? 'Your name must be 120 characters or fewer.' : '')],
  ['password', validatePassword(form.password)],
  ['password_confirmation', !valueOf(form.password_confirmation)
    ? 'Confirm your password.'
    : form.password !== form.password_confirmation
      ? 'Passwords do not match.'
      : ''],
]);

export const removeFieldError = (errors, name) => {
  if (!errors[name]) return errors;
  const next = { ...errors };
  delete next[name];
  return next;
};

export const firstError = (errors) => Object.values(errors)[0] || '';

const optionalUrl = (value) => {
  if (!valueOf(value)) return '';
  try {
    const url = new URL(valueOf(value));
    return ['http:', 'https:'].includes(url.protocol) ? '' : 'Enter a valid website URL.';
  } catch {
    return 'Enter a valid website URL beginning with https://.';
  }
};

const numericRange = (value, label, minimum, maximum) => {
  const requiredError = validateRequired(value, label);
  if (requiredError) return requiredError;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return `${label} must be between ${minimum} and ${maximum}.`;
  }
  return '';
};

export const validateBusinessProfileForm = (form) => compact([
  ['registered_business_name', validateRequired(form.registered_business_name, 'Registered business name')],
  ['business_email', validateEmail(form.business_email, 'Business email')],
  ['phone', validateRequired(form.phone, 'Business phone') || validatePhone(form.phone)],
  ['business_type', validateRequired(form.business_type, 'Business type')],
  ['industry', validateRequired(form.industry, 'Industry')],
  ['website', optionalUrl(form.website)],
  ['address_line_1', validateRequired(form.address_line_1, 'Business address')],
  ['city', validateRequired(form.city, 'City')],
  ['state', validateRequired(form.state, 'State')],
  ['country', /^[A-Z]{2}$/.test(String(form.country || '')) ? '' : 'Select a valid country.'],
]);

export const validateInvoiceSettingsForm = (form) => compact([
  ['invoice_prefix', /^[A-Z0-9-]+$/.test(valueOf(form.invoice_prefix)) ? '' : 'Use letters, numbers or hyphens only.'],
  ['invoice_start_number', numericRange(form.invoice_start_number, 'Starting number', 1, 999999999)],
  ['default_currency', /^[A-Z]{3}$/.test(String(form.default_currency || '')) ? '' : 'Select a valid currency.'],
  ['default_payment_terms_days', numericRange(form.default_payment_terms_days, 'Payment terms', 0, 365)],
  ['default_vat_rate', form.vat_enabled ? numericRange(form.default_vat_rate, 'VAT rate', 0, 100) : ''],
]);

// Match PUT /organization/compliance-profile: optional NRS IDs are not certification.
export const validateNrsIssuerFields = (form) => compact([
  ['nrs_business_id', !valueOf(form.nrs_business_id) || /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(valueOf(form.nrs_business_id))
    ? '' : 'Enter a valid UUID issued by NRS.'],
  ['nrs_service_id', !valueOf(form.nrs_service_id) || /^[a-z0-9]{8}$/i.test(valueOf(form.nrs_service_id))
    ? '' : 'NRS service ID must contain 8 letters or numbers.'],
  ['nrs_postal_zone', valueOf(form.nrs_postal_zone).length <= 20 ? '' : 'NRS postal zone must be 20 characters or fewer.'],
  ['nrs_state_code', valueOf(form.nrs_state_code).length <= 100 ? '' : 'NRS state code must be 100 characters or fewer.'],
  ['nrs_lga_code', valueOf(form.nrs_lga_code).length <= 100 ? '' : 'NRS LGA code must be 100 characters or fewer.'],
]);

export const validateComplianceProfileForm = (form) => ({
  ...compact([
  ['tax_identification_number', !valueOf(form.tax_identification_number)
    ? 'Tax Identification Number is required.'
    : /^[A-Za-z0-9/-]+$/.test(valueOf(form.tax_identification_number))
      ? ''
      : 'TIN may contain only letters, numbers, slashes and hyphens.'],
  ['issuer_type', validateRequired(form.issuer_type, 'Issuer type')],
  ['business_registration_type', validateRequired(form.business_registration_type, 'Registration type')],
  ['vat_number', form.is_vat_registered ? validateRequired(form.vat_number, 'VAT number') : ''],
  ['compliance_confirmed', form.compliance_confirmed ? '' : 'Confirm that your compliance information is accurate.'],
  ]),
  ...validateNrsIssuerFields(form),
});

export const validateBankAccountForm = (form) => compact([
  ['bank_name', validateRequired(form.bank_name, 'Bank name')],
  ['account_name', validateRequired(form.account_name, 'Account name')],
  ['account_number', /^[0-9]{10,30}$/.test(valueOf(form.account_number)) ? '' : 'Enter a valid account number of 10 to 30 digits.'],
  ['currency', /^[A-Z]{3}$/.test(String(form.currency || '')) ? '' : 'Select a valid currency.'],
]);

const validateOptionalEmail = (value) => (
  !valueOf(value) || emailPattern.test(valueOf(value)) ? '' : 'Enter a valid email address.'
);

const validateOptionalLength = (value, maximum, label) => (
  valueOf(value).length <= maximum ? '' : `${label} may not be longer than ${maximum} characters.`
);

export const validateCustomerForm = (form) => compact([
  ['customer_type', ['business', 'individual', 'government', 'international'].includes(form.customer_type) ? '' : 'Select a valid customer type.'],
  ['customer_code', !valueOf(form.customer_code) || /^[A-Za-z0-9._/-]+$/.test(valueOf(form.customer_code)) ? '' : 'Use letters, numbers, dots, slashes, underscores or hyphens only.'],
  ['name', validateRequired(form.name, 'Customer name') || validateOptionalLength(form.name, 180, 'Customer name')],
  ['email', validateOptionalEmail(form.email)],
  ['phone', validatePhone(form.phone)],
  ['contact_person_name', validateOptionalLength(form.contact_person_name, 120, 'Contact name')],
  ['contact_person_email', validateOptionalEmail(form.contact_person_email)],
  ['contact_person_phone', validatePhone(form.contact_person_phone)],
  ['tax_identification_number', validateOptionalLength(form.tax_identification_number, 60, 'TIN')],
  ['cac_registration_number', validateOptionalLength(form.cac_registration_number, 60, 'CAC registration number')],
  ['vat_number', validateOptionalLength(form.vat_number, 60, 'VAT number')],
  ['nrs_buyer_identifier', validateOptionalLength(form.nrs_buyer_identifier, 100, 'NRS buyer identifier')],
  ['preferred_currency', /^[A-Z]{3}$/.test(String(form.preferred_currency || '')) ? '' : 'Select a valid currency.'],
  ['billing_address_line_1', validateOptionalLength(form.billing_address_line_1, 180, 'Billing address')],
  ['billing_address_line_2', validateOptionalLength(form.billing_address_line_2, 180, 'Billing address line 2')],
  ['city', validateOptionalLength(form.city, 80, 'City')],
  ['state', validateOptionalLength(form.state, 80, 'State')],
  ['nrs_postal_zone', validateOptionalLength(form.nrs_postal_zone, 20, 'NRS postal zone')],
  ['nrs_state_code', validateOptionalLength(form.nrs_state_code, 100, 'NRS state code')],
  ['nrs_lga_code', validateOptionalLength(form.nrs_lga_code, 100, 'NRS LGA code')],
  ['country', /^[A-Z]{2}$/.test(String(form.country || '')) ? '' : 'Select a valid country.'],
  ['notes', validateOptionalLength(form.notes, 2000, 'Notes')],
]);

const amountValue = (value) => String(value ?? '').replaceAll(',', '').trim();

const validateMoney = (value, label) => {
  const requiredError = validateRequired(value, label);
  if (requiredError) return requiredError;
  const normalised = amountValue(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalised) || Number(normalised) < 0) {
    return `${label} must be a valid amount with up to 2 decimal places.`;
  }
  return '';
};

const validateOptionalCode = (value, label, maximum = 100) => {
  if (!valueOf(value)) return '';
  if (valueOf(value).length > maximum) return `${label} may not be longer than ${maximum} characters.`;
  return /^[A-Za-z0-9._/-]+$/.test(valueOf(value))
    ? ''
    : `${label} may contain letters, numbers, dots, slashes, underscores or hyphens only.`;
};

export const validateItemForm = (form) => compact([
  ['item_type', ['product', 'service'].includes(form.item_type) ? '' : 'Select a valid item type.'],
  ['item_code', validateOptionalCode(form.item_code, 'Item code', 60)],
  ['name', validateRequired(form.name, 'Product or service name') || validateOptionalLength(form.name, 180, 'Name')],
  ['description', validateOptionalLength(form.description, 2000, 'Description')],
  ['unit_of_measure_id', (!valueOf(form.unit_of_measure_id) && form.item_type === 'service') || (Number.isInteger(Number(form.unit_of_measure_id)) && Number(form.unit_of_measure_id) > 0) ? '' : 'Select a valid unit of measure for this product or service.'],
  ['default_unit_price', form.item_type === 'service' && !valueOf(form.default_unit_price) ? '' : validateMoney(form.default_unit_price, 'Default unit price')],
  ['currency', /^[A-Z]{3}$/.test(String(form.currency || '')) ? '' : 'Select a valid currency.'],
  ['tax_rate_id', !valueOf(form.tax_rate_id) || (Number.isInteger(Number(form.tax_rate_id)) && Number(form.tax_rate_id) > 0) ? '' : 'Select a valid tax treatment.'],
  ['nrs_item_classification_code', validateOptionalCode(form.nrs_item_classification_code, 'NRS classification code', 100)],
  ['firs_item_type', !form.firs_item_type || ['goods', 'service'].includes(form.firs_item_type) ? '' : 'Select a valid FIRS/MBS item type.'],
  ['firs_tax_category_code', validateOptionalCode(form.firs_tax_category_code, 'FIRS/MBS tax category code', 100)],
  ['firs_vat_exemption_code', validateOptionalCode(form.firs_vat_exemption_code, 'FIRS/MBS VAT exemption code', 100)],
  ['firs_unit_code', validateOptionalCode(form.firs_unit_code, 'FIRS/MBS unit code', 50)],
]);

export const validateTaxRateForm = (form) => compact([
  ['code', !valueOf(form.code) ? 'Tax rate code is required.' : validateOptionalCode(form.code, 'Tax rate code', 40)],
  ['name', validateRequired(form.name, 'Tax rate name') || validateOptionalLength(form.name, 100, 'Tax rate name')],
  ['description', validateOptionalLength(form.description, 255, 'Description')],
  ['treatment', ['standard', 'zero_rated', 'exempt', 'non_taxable'].includes(form.treatment) ? '' : 'Select a valid tax treatment.'],
  ['rate_percent', form.treatment === 'standard'
    ? numericRange(form.rate_percent, 'Tax rate', 0, 100)
    : Number(form.rate_percent) === 0 ? '' : 'This tax treatment must use a 0% rate.'],
  ['is_default', form.is_default && !form.is_active ? 'An inactive tax rate cannot be the default.' : ''],
]);

// Organisation-defined measurement units are local catalogue metadata, not
// automatically verified NRS/UBL codes. The server allocates their unique ID.
export const validateCustomUnitForm = (form) => compact([
  ['name', validateRequired(form.name, 'Unit name') || validateOptionalLength(form.name, 80, 'Unit name')],
  ['symbol', validateOptionalLength(form.symbol, 16, 'Unit symbol')],
  ['category', ['product', 'service', 'both'].includes(form.category) ? '' : 'Choose which item types can use this unit.'],
]);
