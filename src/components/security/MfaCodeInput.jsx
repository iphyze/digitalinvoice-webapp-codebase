import { useRef } from 'react'
import {
  MFA_CODE_LENGTH,
  emptyMfaDigits,
  numericCharacters,
  putMfaDigits,
  clearMfaDigit,
} from './mfaCodeUtils'
import styles from './MfaCodeInput.module.css'

/** Accessible, controlled six-digit TOTP input. Used by enrolment and future login challenges. */
export default function MfaCodeInput({ digits = emptyMfaDigits(), onChange, disabled = false, error = '' }) {
  const inputRefs = useRef([])

  const replaceDigits = (index, raw) => {
    const numeric = numericCharacters(raw)
    if (!numeric) {
      onChange(clearMfaDigit(digits, index))
      return
    }
    // SMS/autofill and a complete pasted code fill from the first digit.
    const start = numeric.length >= MFA_CODE_LENGTH ? 0 : index
    onChange(putMfaDigits(digits, start, numeric))
    inputRefs.current[Math.min(start + numeric.length, MFA_CODE_LENGTH - 1)]?.focus()
  }

  const onPaste = (event, index) => {
    const text = numericCharacters(event.clipboardData.getData('text'))
    if (!text) return
    event.preventDefault()
    replaceDigits(index, text)
  }

  const onKeyDown = (event, index) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index]) {
        onChange(clearMfaDigit(digits, index))
      } else if (index > 0) {
        onChange(clearMfaDigit(digits, index - 1))
        inputRefs.current[index - 1]?.focus()
      }
    } else if (event.key === 'Delete') {
      event.preventDefault()
      onChange(clearMfaDigit(digits, index))
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < MFA_CODE_LENGTH - 1) {
      event.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  return (
    <fieldset className={styles.fieldset} disabled={disabled} aria-describedby={error ? 'mfa-code-error' : 'mfa-code-hint'}>
      <legend className={styles.legend}>Authenticator code</legend>
      <div className={styles.boxes} role="group" aria-label="Six-digit authenticator code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => { inputRefs.current[index] = node }}
            className={styles.digit}
            data-invalid={error ? 'true' : undefined}
            id={`mfa-code-${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={MFA_CODE_LENGTH}
            value={digit}
            onChange={(event) => replaceDigits(index, event.target.value)}
            onPaste={(event) => onPaste(event, index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onFocus={(event) => event.target.select()}
            aria-label={`Digit ${index + 1} of ${MFA_CODE_LENGTH}`}
            aria-invalid={Boolean(error)}
            required
          />
        ))}
      </div>
      <p id="mfa-code-hint" className={styles.hint}>Enter the six digits, or paste the complete code.</p>
      {error ? <p id="mfa-code-error" className={styles.error} role="alert">{error}</p> : null}
    </fieldset>
  )
}
