import { ArrowRight, Building2, CircleCheck, Circle, LineChart, Mail, Phone, User, Users } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Textarea from '../../components/forms/Textarea'
import styles from './Plans.module.css'

// Options and copy carried over from the previous app
export const PREMIUM_FEATURES = [
  'Custom invoice approval workflow',
  'Dedicated onboarding and data migration',
  'Advanced compliance reports',
  'Customer portal customization',
  'Payment and reconciliation integrations',
  'Custom user limits and permissions',
  'Priority support and implementation guidance',
  'External system/API integration',
]
const VOLUME_OPTIONS = ['Under 100 invoices/month', '100 - 500 invoices/month', '500 - 2,000 invoices/month', '2,000+ invoices/month', 'Not sure yet'].map((v) => ({ value: v, label: v }))
const TEAM_OPTIONS = ['1 - 5 users', '6 - 20 users', '21 - 50 users', '50+ users', 'Not sure yet'].map((v) => ({ value: v, label: v }))

export const defaultPremiumForm = (user = {}, organization = {}) => ({
  business_name: organization?.name || '',
  contact_name: user?.name || '',
  contact_email: user?.email || organization?.business_email || '',
  contact_phone: organization?.phone || '',
  expected_invoice_volume: '',
  expected_team_size: '',
  required_features: ['Dedicated onboarding and data migration', 'Priority support and implementation guidance'],
  message: '',
})

export default function PremiumRequestModal({ open, form, errors, loading, onClose, onChange, onToggleFeature, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={loading}
      size="lg"
      eyebrow="Premium custom plan"
      title="Tell us what your business needs"
      description="Share your workflow, volume, users and implementation expectations. We will review it and prepare a custom DigitalInvoice package."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onSubmit} loading={loading} iconRight={ArrowRight}>Submit Premium request</Button>
        </>
      )}
    >
      <form className={styles.premiumForm} onSubmit={(event) => { event.preventDefault(); onSubmit() }} noValidate>
        <div className={styles.premiumGrid}>
          <TextField id="premium-business-name" label="Business name" icon={Building2} required autoComplete="organization"
            placeholder="Your registered or trading name" value={form.business_name} error={errors.business_name}
            onChange={(e) => onChange('business_name', e.target.value)} />
          <TextField id="premium-contact-name" label="Contact person" icon={User} required autoComplete="name"
            placeholder="Who should we contact?" value={form.contact_name} error={errors.contact_name}
            onChange={(e) => onChange('contact_name', e.target.value)} />
          <TextField id="premium-contact-email" label="Contact email" icon={Mail} type="email" required autoComplete="email"
            placeholder="name@example.com" value={form.contact_email} error={errors.contact_email}
            onChange={(e) => onChange('contact_email', e.target.value)} />
          <TextField id="premium-contact-phone" label="Phone number" icon={Phone} type="tel" autoComplete="tel"
            placeholder="Optional phone number" value={form.contact_phone} error={errors.contact_phone}
            onChange={(e) => onChange('contact_phone', e.target.value)} />
          <Select id="premium-invoice-volume" label="Expected invoice volume" icon={LineChart} options={VOLUME_OPTIONS}
            placeholder="Select expected volume" value={form.expected_invoice_volume} isClearable
            onChange={(v) => onChange('expected_invoice_volume', v)} />
          <Select id="premium-team-size" label="Expected team size" icon={Users} options={TEAM_OPTIONS}
            placeholder="Select team size" value={form.expected_team_size} isClearable
            onChange={(v) => onChange('expected_team_size', v)} />
        </div>

        <fieldset className={styles.featurePicker}>
          <legend>
            <span className={styles.pickerEyebrow}>Custom needs</span>
            <span className={styles.pickerTitle}>What should the Premium package cover?</span>
          </legend>
          <div className={styles.featureOptions}>
            {PREMIUM_FEATURES.map((feature) => {
              const checked = form.required_features.includes(feature)
              return (
                <button key={feature} type="button" className={styles.featureOption} aria-pressed={checked} onClick={() => onToggleFeature(feature)}>
                  {checked ? <CircleCheck size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                  <span>{feature}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <Textarea id="premium-message" label="Implementation details" required rows={5} value={form.message} error={errors.message}
          placeholder="Tell us about your approval flow, reports, integrations, number of branches, support expectations or any special compliance workflow."
          onChange={(e) => onChange('message', e.target.value)} />
      </form>
    </Modal>
  )
}
