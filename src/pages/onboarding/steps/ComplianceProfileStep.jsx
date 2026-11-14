import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Briefcase, FileText, Hash, ShieldCheck } from 'lucide-react'
import Alert from '../../../components/ui/Alert'
import NrsIssuerFields from '../../../components/nrs/NrsIssuerFields'
import Button from '../../../components/ui/Button'
import TextField from '../../../components/forms/TextField'
import Select from '../../../components/forms/Select'
import Switch from '../../../components/forms/Switch'
import Checkbox from '../../../components/forms/Checkbox'
import onboardingService from '../../../services/onboardingService'
import useToastStore from '../../../stores/useToastStore'
import { getErrorMessage } from '../../../utils/httpError'
import { removeFieldError, validateComplianceProfileForm } from '../../../utils/validation'
import { StepActions, StepHeader } from './StepParts'
import styles from '../Onboarding.module.css'

const ISSUER_TYPES = [
  { value: 'corporate', label: 'Corporate organisation' },
  { value: 'business_name', label: 'Registered business name' },
  { value: 'ngo', label: 'NGO / Non-profit organisation' },
  { value: 'government', label: 'Government organisation' },
  { value: 'individual', label: 'Individual issuer' },
  { value: 'other', label: 'Other issuer' },
]
const REGISTRATION_TYPES = [
  { value: 'cac_rc', label: 'CAC RC — Registered company' },
  { value: 'cac_bn', label: 'CAC BN — Business name' },
  { value: 'incorporated_trustee', label: 'Incorporated trustee' },
  { value: 'government', label: 'Government entity' },
  { value: 'not_applicable', label: 'Not applicable' },
  { value: 'other', label: 'Other' },
]
const fromProfile = (profile) => ({
  tax_identification_number: profile?.tax_identification_number || '',
  issuer_type: profile?.issuer_type || '',
  business_registration_type: profile?.business_registration_type || '',
  is_vat_registered: Number(profile?.is_vat_registered || 0) === 1,
  vat_number: profile?.vat_number || '',
  compliance_confirmed: Boolean(profile?.compliance_confirmed_at),
  nrs_business_id: profile?.nrs_business_id || '',
  nrs_service_id: profile?.nrs_service_id || '',
  nrs_postal_zone: profile?.nrs_postal_zone || '',
  nrs_state_code: profile?.nrs_state_code || '',
  nrs_lga_code: profile?.nrs_lga_code || '',
})

export default function ComplianceProfileStep({ profile, completed, onSaved, onDirtyChange, onBusyChange, onBack, progressLabel }) {
  const showToast = useToastStore((s) => s.showToast)
  const [form, setForm] = useState(() => fromProfile(profile))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => setForm(fromProfile(profile)), [profile])

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(fromProfile(profile)))
  }, [form, profile, onDirtyChange])
  useEffect(() => {
    onBusyChange?.(saving)
    return () => onBusyChange?.(false)
  }, [saving, onBusyChange])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => removeFieldError(current, name))
  }

  const save = async (event) => {
    event.preventDefault()
    const validationErrors = validateComplianceProfileForm(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      showToast('Complete and confirm your compliance information.', 'warning', 'Confirmation required')
      return
    }
    setSaving(true)
    try {
      const response = await onboardingService.updateComplianceProfile(form)
      showToast('Compliance profile saved successfully.', 'success', 'Compliance step complete')
      onSaved('compliance_profile', response.data?.data || {}, 'bank_accounts')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to save compliance profile.'), 'error', 'Unable to save compliance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <StepHeader icon={ShieldCheck} eyebrow="Step 3 of 3" title="Compliance profile"
        description="Provide issuer information required for compliant invoice records." completed={completed} />
      <Alert tone="info" title="Internal setup only for now" className={styles.notice}>
        Your invoices will remain marked as not submitted to NRS until external integration access is enabled.
      </Alert>
      <div className={styles.grid}>
        <TextField id="tax_identification_number" name="tax_identification_number" label="Tax Identification Number (TIN)" icon={BadgeCheck} required
          placeholder="Enter your business TIN" value={form.tax_identification_number}
          onChange={(e) => update('tax_identification_number', e.target.value)} error={errors.tax_identification_number} />
        <Select id="issuer_type" label="Issuer type" icon={Briefcase} options={ISSUER_TYPES} placeholder="Select issuer type"
          value={form.issuer_type} onChange={(v) => update('issuer_type', v)} error={errors.issuer_type} />
        <Select id="business_registration_type" label="Registration type" icon={FileText} options={REGISTRATION_TYPES} placeholder="Select registration type"
          value={form.business_registration_type} onChange={(v) => update('business_registration_type', v)} error={errors.business_registration_type} />
      </div>
      <div className={styles.switches}>
        <Switch id="is_vat_registered" label="This business is VAT registered" description="VAT registration requires a valid VAT number below."
          checked={form.is_vat_registered} onChange={(v) => update('is_vat_registered', v)} />
      </div>
      {form.is_vat_registered ? (
        <div className={`${styles.grid} ${styles.reveal}`}>
          <TextField id="vat_number" name="vat_number" label="VAT number" icon={Hash} required placeholder="Enter VAT registration number"
            value={form.vat_number} onChange={(e) => update('vat_number', e.target.value)} error={errors.vat_number} />
        </div>
      ) : null}
      <div className={styles.nrsSection}>
        <h3>NRS issuer profile</h3>
        <p>Optional until NRS issues your identifiers. Enter only official codes and IDs. Saving these details does not enable live NRS submission.</p>
      </div>
      <div className={styles.grid}>
        <NrsIssuerFields form={form} errors={errors} onChange={update} idPrefix="onboarding" />
      </div>
      <Checkbox id="compliance_confirmed" card className={styles.consent}
        label="I confirm that this compliance information is accurate."
        description="I understand this will be used as issuer information on business invoices."
        checked={form.compliance_confirmed} onChange={(e) => update('compliance_confirmed', e.target.checked)} error={errors.compliance_confirmed} />
      <StepActions progressLabel={progressLabel} onBack={onBack}>
        <Button type="submit" size="lg" loading={saving} iconRight={ArrowRight}>Save and continue</Button>
      </StepActions>
    </form>
  )
}
