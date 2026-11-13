import { useEffect, useState } from 'react'
import { AtSign, BadgeCheck, Barcode, Building2, Contact, Hash, Landmark, Mail, MapPin, Phone, Save, UserRound, WalletCards } from 'lucide-react'
import Drawer from '../../components/overlays/Drawer'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Textarea from '../../components/forms/Textarea'
import Switch from '../../components/forms/Switch'
import customerService from '../../services/customerService'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { validateCustomerForm } from '../../utils/validation'
import { CUSTOMER_TYPES, CUSTOMER_CURRENCIES, CUSTOMER_COUNTRIES } from './customerOptions'
import styles from './CustomerFormDrawer.module.css'

const blank = {
  customer_code: '', customer_type: 'business', name: '', email: '', phone: '',
  contact_person_name: '', contact_person_email: '', contact_person_phone: '',
  tax_identification_number: '', cac_registration_number: '', vat_number: '', nrs_buyer_identifier: '',
  preferred_currency: 'NGN', billing_address_line_1: '', billing_address_line_2: '',
  city: '', state: '', country: 'NG', nrs_postal_zone: '', nrs_state_code: '', nrs_lga_code: '',
  notes: '', is_active: true,
}
const initialForm = (customer, defaultCurrency) => ({ ...blank, preferred_currency: defaultCurrency || 'NGN', ...customer,
  is_active: customer ? Boolean(Number(customer.is_active)) : true })

export default function CustomerFormDrawer({ open, customer, defaultCurrency = 'NGN', onClose, onSaved }) {
  const toast = useToastStore((s) => s.showToast)
  const editing = Boolean(customer?.id)
  const [form, setForm] = useState(() => initialForm(customer, defaultCurrency))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setForm(initialForm(customer, defaultCurrency)); setErrors({}); setSubmitted(false) } }, [open, customer, defaultCurrency])

  const update = (field, value) => {
    const next = { ...form, [field]: value }
    setForm(next)
    if (submitted) setErrors(validateCustomerForm(next))
  }
  const submit = async (event) => {
    event.preventDefault()
    const validationErrors = validateCustomerForm(form)
    setSubmitted(true)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) { toast('Please review the highlighted customer details.', 'warning', 'Required information'); return }
    setSaving(true)
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0, ...(editing ? { id: customer.id } : {}) }
      const response = editing ? await customerService.update(payload) : await customerService.create(payload)
      toast(editing ? 'Customer information updated successfully.' : 'Customer added to your billing records.', 'success', editing ? 'Customer updated' : 'Customer created')
      onSaved?.(response.data?.data?.customer)
    } catch (error) { toast(getErrorMessage(error, 'Unable to save customer details.'), 'error', 'Could not save customer') }
    finally { setSaving(false) }
  }
  const text = (key, label, placeholder, icon, options = {}) => <TextField id={`customer-${key}`} label={label} value={form[key] ?? ''} onChange={(e) => update(key, options.uppercase ? e.target.value.toUpperCase() : e.target.value)} placeholder={placeholder} icon={icon} error={errors[key]} size="md" {...(options.type ? { type: options.type } : {})} autoComplete={options.autoComplete || 'off'} />
  const select = (key, label, choices, icon) => <Select id={`customer-${key}`} label={label} value={form[key]} onChange={(value) => update(key, value)} options={choices} icon={icon} size="md" error={errors[key]} />
  return <Drawer open={open} onClose={onClose} busy={saving} eyebrow="Customer record" title={editing ? 'Edit customer' : 'Add customer'} description={editing ? 'Keep invoicing and tax information accurate.' : 'Create a customer before issuing an invoice.'} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="customer-data-form" loading={saving} icon={Save}>{editing ? 'Save changes' : 'Create customer'}</Button></>}>
    <form id="customer-data-form" className={styles.form} onSubmit={submit} noValidate>
      <section className={styles.section}>
        <h3>Customer details</h3>
        <div className={styles.grid}>
          {select('customer_type', 'Customer type *', CUSTOMER_TYPES, Building2)}
          {text('customer_code', 'Customer code', 'Generated if empty', Hash, { uppercase: true })}
          <div className={styles.span}>{text('name', 'Customer / business name *', 'Enter billing customer name', Building2, { autoComplete: 'organization' })}</div>
          {text('email', 'Email address', 'billing@company.ng', Mail, { type: 'email', autoComplete: 'email' })}
          {text('phone', 'Phone number', '0803 000 0000', Phone, { type: 'tel', autoComplete: 'tel' })}
          <div className={styles.span}>{select('preferred_currency', 'Preferred currency *', CUSTOMER_CURRENCIES, WalletCards)}</div>
        </div>
      </section>
      <section className={styles.section}>
        <h3>Tax and compliance</h3>
        <div className={styles.grid}>
          {text('tax_identification_number', 'TIN', 'Tax identification number', Barcode)}
          {text('cac_registration_number', 'CAC registration no.', 'RC / BN number', Landmark)}
          {text('vat_number', 'VAT number', 'Optional', Hash)}
          {text('nrs_buyer_identifier', 'NRS buyer identifier', 'Reserved for integration', BadgeCheck)}
        </div>
      </section>
      <section className={styles.section}>
        <h3>Billing address</h3>
        <div className={styles.grid}>
          <div className={styles.span}>{text('billing_address_line_1', 'Address line 1', 'Street and building', MapPin, { autoComplete: 'address-line1' })}</div>
          <div className={styles.span}>{text('billing_address_line_2', 'Address line 2', 'Suite, building or landmark', MapPin, { autoComplete: 'address-line2' })}</div>
          {text('city', 'City', 'City', MapPin, { autoComplete: 'address-level2' })}
          {text('state', 'State', 'State', MapPin, { autoComplete: 'address-level1' })}
          {text('nrs_postal_zone', 'NRS postal zone', 'Postal code', MapPin, { autoComplete: 'postal-code' })}
          {text('nrs_state_code', 'NRS state code', 'Code from NRS resource list', Hash)}
          <div className={styles.span}>{text('nrs_lga_code', 'NRS LGA code', 'Code from NRS resource list', Hash)}</div>
          <div className={styles.span}>{select('country', 'Country', CUSTOMER_COUNTRIES, MapPin)}</div>
        </div>
      </section>
      <section className={styles.section}>
        <h3>Contact person <span>Optional</span></h3>
        <div className={styles.grid}>
          {text('contact_person_name', 'Contact name', 'Primary contact person', UserRound, { autoComplete: 'name' })}
          {text('contact_person_email', 'Contact email', 'contact@company.ng', AtSign, { type: 'email', autoComplete: 'email' })}
          <div className={styles.span}>{text('contact_person_phone', 'Contact phone', 'Optional phone number', Contact, { type: 'tel', autoComplete: 'tel' })}</div>
        </div>
      </section>
      <section className={styles.section}>
        <Textarea id="customer-notes" label="Notes" value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} error={errors.notes} placeholder="Additional billing or service notes for your team." rows={3} />
        {editing && <Switch id="customer-active" checked={form.is_active} onChange={(v) => update('is_active', v)} label="Active customer" description="Inactive customers remain recorded but cannot be selected for new invoices." />}
      </section>
    </form>
  </Drawer>
}
