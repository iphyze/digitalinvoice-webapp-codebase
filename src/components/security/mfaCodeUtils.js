/** Helpers for the six-box TOTP entry UI. No API or credential handling. */
export const MFA_CODE_LENGTH = 6;

export const emptyMfaDigits = () => Array(MFA_CODE_LENGTH).fill('');

export const numericCharacters = (value) => String(value ?? '').replace(/\D/g, '');

export const putMfaDigits = (previous, index, value) => {
  const next = [...previous];
  const clean = numericCharacters(value);
  for (let offset = 0; offset < clean.length && index + offset < MFA_CODE_LENGTH; offset += 1) {
    next[index + offset] = clean[offset];
  }
  return next;
};

export const clearMfaDigit = (previous, index) => {
  const next = [...previous];
  next[index] = '';
  return next;
};

export const completeMfaCode = (digits) => digits.length === MFA_CODE_LENGTH
  && digits.every((digit) => /^\d$/.test(digit))
  ? digits.join('')
  : null;
