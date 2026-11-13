import { useEffect, useState } from 'react'
import { ArrowRight, CalendarClock, Coins, FileText, Hash, Percent } from 'lucide-react'
import Button from '../../../components/ui/Button'
import TextField from '../../../components/forms/TextField'
import Select from '../../../components/forms/Select'
import Switch from '../../../components/forms/Switch'
import Textarea from '../../../components/forms/Textarea'
import onboardingService from '../../../services/onboardingService'
import useToastStore from '../../../stores/useToastStore'
import { getErrorMessage } from '../../../utils/httpError'
import { removeFieldError, validateInvoiceSettingsForm } from '../../../utils/validation'
import { StepActions, StepHeader } from './StepParts'
import styles from '../Onboarding.module.css'

export const CURRENCIES = [
  { value: 'NGN', label: 'Nigerian Naira (NGN)' },
  { value: 'USD', label: 'United States Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]
const INITIAL = {
  invoice_prefix: 'INV', invoice_start_number: '1', default_currency: 'NGN', vat_enabled: true, default_vat_rate: '7.50',
  default_payment_terms_days: '30', invoice_footer_note: '', payment_instructions: '', enable_pay_now_by_default: false,
}
const fromSettings = (settings) => ({
  ...INITIAL,
  ...(settings || {}),
  invoice_start_number: String(settings?.invoice_start_number ?? 1),
  default_vat_rate: String(settings?.default_vat_rate ?? '7.50'),
  default_payment_terms_days: String(settings?.default_payment_terms_days ?? 30),
  vat_enabled: Number(settings?.vat_enabled ?? 1) === 1,
  enable_pay_now_by_default: Number(settings?.enable_pay_now_by_default ?? 0) === 1,
  invoice_footer_note: settings?.invoice_footer_note || '',
  payment_instructions: settings?.payment_instructions || '',
})

export default function InvoiceSettingsStep({ settings, completed, onSaved, onBack, progressLabel }) {
  const showToast = useToastStore((s) => s.showToast)
  const [form, setForm] = useState(() => fromSettings(settings))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => setForm(fromSettings(settings)), [settings])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => removeFieldError(current, name))
  }
  const onInput = (event) => update(event.target.name, event.target.value)

  const save = async (event) => {
    event.preventDefault()
    const validationErrors = validateInvoiceSettingsForm(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      showToast('Please correct the highlighted invoice settings.', 'warning', 'Check invoice settings')
      return
    }
    setSaving(true)
    try {
      const response = await onboardingService.updateInvoiceSettings({
        ...form,
        invoice_start_number: Number(form.invoice_start_number),
        default_vat_rate: Number(form.default_vat_rate),
        default_payment_terms_days: Number(form.default_payment_terms_days),
      })
      showToast('Invoice defaults saved successfully.', 'success', 'Settings complete')
      onSaved('invoice_settings', response.data?.data || {}, 'compliance_profile')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to save invoice settings.'), 'error', 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <StepHeader icon={FileText} eyebrow="Step 2 of 3" title="Invoice settings"
        description="Configure your numbering, currency, tax and payment defaults." completed={completed} />
      <div className={styles.grid}>
        <TextField id="invoice_prefix" name="invoice_prefix" label="Invoice number prefix" icon={Hash} required placeholder="INV"
          value={form.invoice_prefix} onChange={onInput} error={errors.invoice_prefix} />
        <TextField id="invoice_start_number" name="invoice_start_number" label="Starting number" icon={Hash} required inputMode="numeric" placeholder="1"
          value={form.invoice_start_number} onChange={onInput} error={errors.invoice_start_number} />
        <Select id="default_currency" label="Default currency" icon={Coins} options={CURRENCIES}
          value={form.default_currency} onChange={(v) => update('default_currency', v)} error={errors.default_currency} />
        <TextField id="default_payment_terms_days" name="default_payment_terms_days" label="Default payment terms (days)" icon={CalendarClock} required inputMode="numeric" placeholder="30"
          value={form.default_payment_terms_days} onChange={onInput} error={errors.default_payment_terms_days} />
      </div>
      <div className={styles.switches}>
        <Switch id="vat_enabled" label="Apply VAT by default" description="Add VAT to invoice lines unless changed on an invoice."
          checked={form.vat_enabled} onChange={(v) => update('vat_enabled', v)} />
        <Switch id="enable_pay_now_by_default" label="Enable Pay-Now links" description="Prepared for customer payment links when enabled later."
          checked={form.enable_pay_now_by_default} onChange={(v) => update('enable_pay_now_by_default', v)} />
      </div>
      <div className={styles.grid}>
        {form.vat_enabled ? (
          <TextField id="default_vat_rate" name="default_vat_rate" label="Default VAT rate (%)" icon={Percent} required inputMode="decimal" placeholder="7.50"
            value={form.default_vat_rate} onChange={onInput} error={errors.default_vat_rate} className={`${styles.reveal}`} />
        ) : null}
        <Textarea id="invoice_footer_note" name="invoice_footer_note" label="Invoice footer note" rows={3} placeholder="Thank you for your business."
          value={form.invoice_footer_note} onChange={onInput} error={errors.invoice_footer_note} className={styles.span} />
        <Textarea id="payment_instructions" name="payment_instructions" label="Payment instructions" rows={3}
          placeholder="Payment description or instructions shown on issued invoices."
          value={form.payment_instructions} onChange={onInput} error={errors.payment_instructions} className={styles.span} />
      </div>
      <StepActions progressLabel={progressLabel} onBack={onBack}>
        <Button type="submit" size="lg" loading={saving} iconRight={ArrowRight}>Save and continue</Button>
      </StepActions>
    </form>
  )
}
