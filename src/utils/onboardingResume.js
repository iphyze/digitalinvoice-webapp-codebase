/** Required steps use the server-owned onboarding progress; bank accounts remain optional. */
export const ONBOARDING_REQUIRED_STEPS = ['business_profile', 'invoice_settings', 'compliance_profile']

export function nextOnboardingStep(onboarding) {
  if (onboarding?.next_step && [...ONBOARDING_REQUIRED_STEPS, 'finish'].includes(onboarding.next_step)) {
    return onboarding.next_step
  }
  const incomplete = ONBOARDING_REQUIRED_STEPS.find((key) => !onboarding?.steps?.[key]?.completed)
  return incomplete || 'finish'
}

export function hasSavedOnboardingProgress(onboarding) {
  return ONBOARDING_REQUIRED_STEPS.some((key) => Boolean(onboarding?.steps?.[key]?.completed))
}

/** Blank optional bank details mean skip; partially entered details must be saved or corrected. */
export function hasBankAccountDraft(form) {
  return ['bank_name', 'account_name', 'account_number'].some((key) => String(form?.[key] ?? '').trim() !== '')
}
