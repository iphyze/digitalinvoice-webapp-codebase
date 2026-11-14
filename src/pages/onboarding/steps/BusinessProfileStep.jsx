import { useEffect, useState } from 'react'
import { ArrowRight, Briefcase, Building2, Globe, Hash, Mail, MapPin, Phone } from 'lucide-react'
import Button from '../../../components/ui/Button'
import TextField from '../../../components/forms/TextField'
import Select from '../../../components/forms/Select'
import onboardingService from '../../../services/onboardingService'
import useToastStore from '../../../stores/useToastStore'
import { getErrorMessage } from '../../../utils/httpError'
import { removeFieldError, validateBusinessProfileForm } from '../../../utils/validation'
import { StepActions, StepHeader } from './StepParts'
import styles from '../Onboarding.module.css'

// Options, fields and copy carried over from the previous app
const BUSINESS_TYPES = [
  { value: 'limited_company', label: 'Limited company' },
  { value: 'business_name', label: 'Registered business name' },
  { value: 'sole_proprietorship', label: 'Sole proprietorship' },
  { value: 'ngo', label: 'NGO / Incorporated trustee' },
  { value: 'government', label: 'Government organisation' },
  { value: 'other', label: 'Other' },
]
const COUNTRIES = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
]
const FIELDS = ['registered_business_name', 'trading_name', 'business_email', 'phone', 'cac_registration_number', 'business_type', 'industry', 'website', 'address_line_1', 'address_line_2', 'city', 'state']
const fromProfile = (profile, organization) => ({
  ...Object.fromEntries(FIELDS.map((key) => [key, profile?.[key] || ''])),
  registered_business_name: profile?.registered_business_name || organization?.name || '',
  country: profile?.country || 'NG',
})

export default function BusinessProfileStep({ profile, organization, completed, onSaved, onDirtyChange, onBusyChange, progressLabel }) {
  const showToast = useToastStore((s) => s.showToast)
  const [form, setForm] = useState(() => fromProfile(profile, organization))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => setForm(fromProfile(profile, organization)), [profile, organization])

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(fromProfile(profile, organization)))
  }, [form, profile, organization, onDirtyChange])
  useEffect(() => {
    onBusyChange?.(saving)
    return () => onBusyChange?.(false)
  }, [saving, onBusyChange])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => removeFieldError(current, name))
  }
  const onInput = (event) => update(event.target.name, event.target.value)

  const save = async (event) => {
    event.preventDefault()
    const validationErrors = validateBusinessProfileForm(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      showToast('Please correct the highlighted business details.', 'warning', 'Check required fields')
      return
    }
    setSaving(true)
    try {
      const response = await onboardingService.updateProfile(form)
      showToast('Business profile saved successfully.', 'success', 'Profile complete')
      onSaved('business_profile', response.data?.data || {}, 'invoice_settings')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to save business profile.'), 'error', 'Unable to save profile')
    } finally {
      setSaving(false)
    }
  }

  const field = (name, label, props = {}) => (
    <TextField id={name} name={name} label={label} value={form[name]} onChange={onInput} error={errors[name]} {...props} />
  )

  return (
    <form onSubmit={save} noValidate>
      <StepHeader icon={Building2} eyebrow="Step 1 of 3" title="Business profile"
        description="Tell us about the business that will issue invoices through DigitalInvoice." completed={completed} />
      <div className={styles.grid}>
        {field('registered_business_name', 'Registered business name', { icon: Building2, required: true, placeholder: 'Dynamix Field Ltd', autoComplete: 'organization' })}
        {field('trading_name', 'Trading name', { icon: Building2, placeholder: 'Optional trading name' })}
        {field('business_email', 'Business email', { icon: Mail, type: 'email', required: true, placeholder: 'accounts@business.com', autoComplete: 'email' })}
        {field('phone', 'Business phone', { icon: Phone, type: 'tel', required: true, placeholder: '0801 234 5678', autoComplete: 'tel' })}
        <Select id="business_type" label="Business type" icon={Briefcase} options={BUSINESS_TYPES} placeholder="Select business type"
          value={form.business_type} onChange={(v) => update('business_type', v)} error={errors.business_type} />
        {field('cac_registration_number', 'CAC registration number', { icon: Hash, placeholder: 'Optional at this step' })}
        {field('industry', 'Industry', { icon: Briefcase, required: true, placeholder: 'Technology / Financial services' })}
        {field('website', 'Website', { icon: Globe, type: 'url', placeholder: 'https://yourbusiness.com', autoComplete: 'url' })}
        {field('address_line_1', 'Business address', { icon: MapPin, required: true, placeholder: 'Street and building address', autoComplete: 'address-line1', className: styles.span })}
        {field('address_line_2', 'Address line 2', { icon: MapPin, placeholder: 'Suite, floor or landmark (optional)', autoComplete: 'address-line2', className: styles.span })}
        {field('city', 'City', { required: true, placeholder: 'Lagos', autoComplete: 'address-level2' })}
        {field('state', 'State', { required: true, placeholder: 'Lagos', autoComplete: 'address-level1' })}
        <Select id="country" label="Country" icon={Globe} options={COUNTRIES} value={form.country}
          onChange={(v) => update('country', v)} error={errors.country} />
      </div>
      <StepActions progressLabel={progressLabel}>
        <Button type="submit" size="lg" loading={saving} iconRight={ArrowRight}>Save and continue</Button>
      </StepActions>
    </form>
  )
}
