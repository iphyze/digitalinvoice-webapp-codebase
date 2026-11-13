import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, Briefcase, Building2, CheckCircle2, Coins, FileText, Globe, Hash,
  ImagePlus, Landmark, Mail, MapPin, Pencil, Plus, ReceiptText, RefreshCw,
  Save, ShieldCheck, Trash2, Upload, UserRound,
} from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import PageLoader from '../../components/ui/PageLoader'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import Checkbox from '../../components/forms/Checkbox'
import Drawer from '../../components/overlays/Drawer'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import NrsIssuerFields from '../../components/nrs/NrsIssuerFields'
import api from '../../services/api'
import onboardingService from '../../services/onboardingService'
import firsService from '../../services/firsService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import {
  validateBankAccountForm, validateBusinessProfileForm,
  validateComplianceProfileForm, validateInvoiceSettingsForm,
} from '../../utils/validation'
import {
  BUSINESS_TYPES, ISSUER_TYPES, REGISTRATION_TYPES, COUNTRIES, CURRENCIES,
  businessForm, invoiceForm, complianceForm, invoicePayload, resourceOptions,
} from './organizationSettingsModel'
import styles from './OrganizationSettings.module.css'

const TABS = [
  { id: 'profile', label: 'Business profile', icon: Building2 },
  { id: 'invoice', label: 'Invoice defaults', icon: ReceiptText },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'banking', label: 'Payment accounts', icon: Landmark },
  { id: 'branding', label: 'Branding', icon: ImagePlus },
]
const BANK_INITIAL = { id: null, bank_name: '', account_name: '', account_number: '', currency: 'NGN', is_default: false }
const bool = (value) => value === true || value === 1 || value === '1'
const unwrap = (response) => response?.data?.data || {}
const labelStatus = (value) => String(value || 'not_configured').replaceAll('_', ' ')

function Panel({ eyebrow, title, description, icon: Icon, children }) {
  return <section className={styles.panel}>
    <div className={styles.panelHead}>
      <span className={styles.panelIcon}><Icon size={20} aria-hidden="true" /></span>
      <div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
    </div>
    {children}
  </section>
}

export default function OrganizationSettings() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'profile'
  // Depend on the stable scalar name: background session refresh creates a new
  // organisation object and must not overwrite in-progress form edits.
  const organizationName = useAuthStore((state) => state.organization?.name || '')
  const refreshSessionState = useAuthStore((state) => state.refreshSessionState)
  const toast = useToastStore((state) => state.showToast)
  const [profile, setProfile] = useState(() => businessForm({}, { name: organizationName }))
  const [invoice, setInvoice] = useState(() => invoiceForm())
  const [compliance, setCompliance] = useState(() => complianceForm())
  const [nrsStatus, setNrsStatus] = useState({})
  const [accounts, setAccounts] = useState([])
  const [resources, setResources] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState('')
  const [errors, setErrors] = useState({ profile: {}, invoice: {}, compliance: {}, bank: {} })
  const [bankOpen, setBankOpen] = useState(false)
  const [bankForm, setBankForm] = useState(BANK_INITIAL)
  const [bankDelete, setBankDelete] = useState(null)
  const [logoAvailable, setLogoAvailable] = useState(false)
  const [logoVersion, setLogoVersion] = useState(0)
  const [logoUrl, setLogoUrl] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [profileRes, invoiceRes, complianceRes, bankRes] = await Promise.all([
        onboardingService.getProfile(), onboardingService.getInvoiceSettings(),
        onboardingService.getComplianceProfile(), onboardingService.getBankAccounts(),
      ])
      const profileData = unwrap(profileRes).profile || {}
      const complianceData = unwrap(complianceRes).profile || {}
      setProfile(businessForm(profileData, { name: organizationName }))
      setInvoice(invoiceForm(unwrap(invoiceRes).settings))
      setCompliance(complianceForm(complianceData))
      setNrsStatus({ nrs_mbs_status: complianceData.nrs_mbs_status, integration_environment: complianceData.integration_environment })
      setAccounts(unwrap(bankRes).bank_accounts || [])
      setLogoAvailable(Boolean(profileData.logo_original_name || profileData.logo_updated_at))
      setErrors({ profile: {}, invoice: {}, compliance: {}, bank: {} })
      // Local resource lists help with defaults, but must never block settings editing.
      firsService.options().then((response) => setResources(unwrap(response).resource_options || {})).catch(() => setResources({}))
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load organisation settings.'))
    } finally {
      setLoading(false)
    }
  }, [organizationName])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!logoAvailable) { setLogoUrl(''); return undefined }
    let active = true
    let nextUrl = ''
    api.get('/organization/logo', { responseType: 'blob' }).then((response) => {
      if (!active) return
      nextUrl = URL.createObjectURL(response.data)
      setLogoUrl(nextUrl)
    }).catch(() => { if (active) setLogoUrl('') })
    return () => { active = false; if (nextUrl) URL.revokeObjectURL(nextUrl) }
  }, [logoAvailable, logoVersion])

  const chooseTab = (nextTab) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    if (nextTab === 'profile') next.delete('tab')
    else next.set('tab', nextTab)
    return next
  })
  const update = (group, name, value) => {
    const setter = { profile: setProfile, invoice: setInvoice, compliance: setCompliance, bank: setBankForm }[group]
    const validate = {
      profile: validateBusinessProfileForm, invoice: validateInvoiceSettingsForm,
      compliance: validateComplianceProfileForm, bank: validateBankAccountForm,
    }[group]
    const currentForm = { profile, invoice, compliance, bank: bankForm }[group]
    const nextForm = { ...currentForm, [name]: value }
    setter(nextForm)
    setErrors((current) => {
      if (!Object.keys(current[group]).length) return current
      const refreshed = validate(nextForm)
      if (group === 'invoice' && nextForm.firs_default_transaction_type === 'b2b'
        && nextForm.firs_default_document_type !== 'tax_invoice') {
        refreshed.firs_default_document_type = 'B2B defaults must use a tax invoice.'
      }
      return { ...current, [group]: refreshed }
    })
  }
  const field = (group, name, label, icon, props = {}) => {
    const value = { profile, invoice, compliance, bank: bankForm }[group][name] ?? ''
    return <TextField id={`settings-${group}-${name}`} name={name} label={label} icon={icon} value={value}
      onChange={(event) => update(group, name, event.target.value)} error={errors[group][name]} {...props} />
  }
  const select = (group, name, label, options, icon, props = {}) => (
    <Select id={`settings-${group}-${name}`} label={label} icon={icon} options={options}
      value={{ profile, invoice, compliance, bank: bankForm }[group][name]}
      onChange={(value) => update(group, name, value)} error={errors[group][name]} {...props} />
  )
  const toggle = (group, name, label, description) => (
    <Switch id={`settings-${group}-${name}`} label={label} description={description}
      checked={Boolean({ profile, invoice, compliance, bank: bankForm }[group][name])}
      onChange={(value) => update(group, name, value)} />
  )

  const save = async (group, event) => {
    event.preventDefault()
    const form = { profile, invoice, compliance }[group]
    const validate = { profile: validateBusinessProfileForm, invoice: validateInvoiceSettingsForm, compliance: validateComplianceProfileForm }[group]
    const failures = validate(form)
    if (group === 'invoice' && invoice.firs_default_transaction_type === 'b2b' && invoice.firs_default_document_type !== 'tax_invoice') {
      failures.firs_default_document_type = 'B2B defaults must use a tax invoice.'
    }
    setErrors((current) => ({ ...current, [group]: failures }))
    if (Object.keys(failures).length) { toast('Please correct the highlighted fields.', 'warning', 'Check settings'); return }
    setSaving(group)
    try {
      if (group === 'profile') {
        const payload = { ...profile, registered_business_name: profile.registered_business_name.trim(), business_email: profile.business_email.trim().toLowerCase(), country: profile.country.toUpperCase() }
        const response = await onboardingService.updateProfile(payload)
        setProfile(businessForm(unwrap(response).profile || payload, { name: organizationName }))
        await refreshSessionState().catch(() => null)
      } else if (group === 'invoice') {
        const payload = invoicePayload(invoice)
        const response = await onboardingService.updateInvoiceSettings(payload)
        setInvoice(invoiceForm(unwrap(response).settings || payload))
      } else {
        const payload = { ...compliance, tax_identification_number: compliance.tax_identification_number.trim(), compliance_confirmed: true }
        const response = await onboardingService.updateComplianceProfile(payload)
        const saved = unwrap(response).profile || payload
        setCompliance(complianceForm(saved))
        setNrsStatus({ nrs_mbs_status: saved.nrs_mbs_status, integration_environment: saved.integration_environment })
      }
      toast(group === 'profile' ? 'Business profile updated successfully.' : group === 'invoice' ? 'Invoice defaults updated successfully.' : 'Compliance profile saved successfully.', 'success', 'Settings saved')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to save organisation settings.'), 'error', 'Unable to save settings')
    } finally { setSaving('') }
  }

  const openBank = (account) => {
    setErrors((current) => ({ ...current, bank: {} }))
    setBankForm(account ? {
      id: account.id, bank_name: account.bank_name || '', account_name: account.account_name || '',
      account_number: String(account.account_number || ''), currency: account.currency || 'NGN', is_default: bool(account.is_default),
    } : { ...BANK_INITIAL, is_default: accounts.length === 0 })
    setBankOpen(true)
  }
  const saveBank = async (event) => {
    event.preventDefault()
    const failures = validateBankAccountForm(bankForm)
    setErrors((current) => ({ ...current, bank: failures }))
    if (Object.keys(failures).length) return
    setSaving('bank')
    try {
      const payload = { ...bankForm, account_number: bankForm.account_number.trim(), bank_name: bankForm.bank_name.trim(), account_name: bankForm.account_name.trim() }
      const response = bankForm.id ? await onboardingService.updateBankAccount(payload) : await onboardingService.addBankAccount(payload)
      setAccounts(unwrap(response).bank_accounts || [])
      setBankOpen(false)
      toast(bankForm.id ? 'Payment account updated.' : 'Payment account added.', 'success', 'Account saved')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to save payment account.'), 'error', 'Account not saved')
    } finally { setSaving('') }
  }
  const removeBank = async () => {
    if (!bankDelete) return
    setSaving('bank-delete')
    try {
      const response = await onboardingService.removeBankAccount(bankDelete.id)
      setAccounts(unwrap(response).bank_accounts || [])
      setBankDelete(null)
      toast('Payment account removed.', 'success', 'Account removed')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to remove payment account.'), 'error', 'Unable to remove account')
    } finally { setSaving('') }
  }
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast('Choose a PNG, JPG or WEBP file up to 2 MB.', 'warning', 'Invalid logo'); return
    }
    setSaving('logo')
    try {
      await onboardingService.uploadLogo(file)
      setLogoAvailable(true)
      setLogoVersion((value) => value + 1)
      toast('Logo uploaded successfully.', 'success', 'Branding updated')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to upload logo.'), 'error', 'Upload failed')
    } finally { setSaving('') }
  }
  const removeLogo = async () => {
    setSaving('logo')
    try {
      await onboardingService.removeLogo()
      setLogoAvailable(false)
      setLogoVersion((value) => value + 1)
      toast('Logo removed successfully.', 'success', 'Branding updated')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to remove logo.'), 'error', 'Unable to remove logo')
    } finally { setSaving('') }
  }

  if (loading) return <PageLoader message="Loading organisation settings..." />
  if (loadError) return <div className={styles.page}>
    <PageHeader eyebrow="Workspace settings" title="Organisation settings" />
    <Alert tone="danger" title="Settings unavailable">{loadError}</Alert>
    <Button variant="secondary" icon={RefreshCw} onClick={load}>Try again</Button>
  </div>

  const resourceSelect = (name, label, resourceName, fallback, normalize = (value) => value) => {
    const options = resourceOptions(resources[resourceName], { value: invoice[name], label: invoice[name] || fallback.label }, normalize)
    if (!options.some((item) => item.value === fallback.value)) options.push(fallback)
    return select('invoice', name, label, options, Hash, { isSearchable: true })
  }

  return <div className={styles.page}>
    <PageHeader eyebrow="Workspace settings" title="Organisation settings"
      description="Manage your business, invoicing, compliance and payment details." />
    <nav className={styles.tabs} aria-label="Organisation settings sections">
      {TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={styles.tab}
        aria-current={tab === id ? 'page' : undefined} data-active={tab === id || undefined} onClick={() => chooseTab(id)}>
        <Icon size={17} aria-hidden="true" /><span>{label}</span>
      </button>)}
    </nav>

    {tab === 'profile' && <Panel eyebrow="Business identity" title="Business profile" icon={Building2}
      description="Your registered business and contact information on invoices.">
      <form onSubmit={(event) => save('profile', event)} noValidate>
        <div className={styles.grid}>
          {field('profile', 'registered_business_name', 'Registered business name', Building2, { required: true, maxLength: 180 })}
          {field('profile', 'trading_name', 'Trading name', Building2, { maxLength: 180 })}
          {field('profile', 'business_email', 'Business email', Mail, { required: true, type: 'email', maxLength: 190 })}
          {field('profile', 'phone', 'Business phone', UserRound, { required: true, type: 'tel', maxLength: 30 })}
          {select('profile', 'business_type', 'Business type', BUSINESS_TYPES, Briefcase)}
          {field('profile', 'cac_registration_number', 'CAC registration number', Hash, { maxLength: 60 })}
          {field('profile', 'industry', 'Industry', Briefcase, { required: true, maxLength: 100 })}
          {field('profile', 'website', 'Website', Globe, { type: 'url', maxLength: 190, placeholder: 'https://example.com' })}
          {field('profile', 'address_line_1', 'Business address', MapPin, { required: true, maxLength: 180, className: styles.span })}
          {field('profile', 'address_line_2', 'Address line 2', MapPin, { maxLength: 180, className: styles.span })}
          {field('profile', 'city', 'City', MapPin, { required: true, maxLength: 80 })}
          {field('profile', 'state', 'State', MapPin, { required: true, maxLength: 80 })}
          {select('profile', 'country', 'Country', COUNTRIES, Globe)}
        </div>
        <div className={styles.actions}><Button type="submit" icon={Save} loading={saving === 'profile'}>Save business profile</Button></div>
      </form>
    </Panel>}

    {tab === 'invoice' && <Panel eyebrow="Document defaults" title="Invoice settings" icon={ReceiptText}
      description="Numbering, payment instructions and local FIRS/NRS readiness defaults.">
      <form onSubmit={(event) => save('invoice', event)} noValidate>
        <div className={styles.grid}>
          {field('invoice', 'invoice_prefix', 'Invoice number prefix', Hash, { required: true, maxLength: 15 })}
          {field('invoice', 'invoice_start_number', 'Starting invoice number', Hash, { required: true, inputMode: 'numeric' })}
          {select('invoice', 'default_currency', 'Default currency', CURRENCIES, Coins)}
          {field('invoice', 'default_payment_terms_days', 'Payment terms (days)', Hash, { required: true, inputMode: 'numeric' })}
        </div>
        <div className={styles.switches}>{toggle('invoice', 'vat_enabled', 'VAT enabled', 'Calculate VAT on new invoices using the default rate below.')}</div>
        {invoice.vat_enabled && <div className={styles.grid}>{field('invoice', 'default_vat_rate', 'Default VAT rate (%)', Hash, { required: true, inputMode: 'decimal' })}</div>}
        <div className={styles.grid}>
          <Textarea id="settings-invoice_footer_note" label="Invoice footer note" rows={3} maxLength={1000} value={invoice.invoice_footer_note}
            onChange={(event) => update('invoice', 'invoice_footer_note', event.target.value)} />
          <Textarea id="settings-payment_instructions" label="Payment instructions" rows={3} maxLength={1000} value={invoice.payment_instructions}
            onChange={(event) => update('invoice', 'payment_instructions', event.target.value)} />
        </div>
        <div className={styles.switches}>{toggle('invoice', 'enable_pay_now_by_default', 'Enable Pay Now by default', 'Applies only when payment integration is available.')}</div>
        <div className={styles.subheading}><h3>FIRS/NRS invoice defaults</h3><p>Used for internal preparation only. These settings do not submit documents to NRS.</p></div>
        <div className={styles.grid}>
          {select('invoice', 'firs_default_transaction_type', 'Default transaction model', [
            { value: 'b2b', label: 'B2B — Tax invoice' }, { value: 'b2c', label: 'B2C — Simplified tax invoice' },
          ], FileText, { onChange: (value) => {
            update('invoice', 'firs_default_transaction_type', value)
            update('invoice', 'firs_default_document_type', value === 'b2b' ? 'tax_invoice' : 'simplified_tax_invoice')
          } })}
          {select('invoice', 'firs_default_document_type', 'Default document type', [
            { value: 'tax_invoice', label: 'Tax invoice' }, { value: 'simplified_tax_invoice', label: 'Simplified tax invoice' },
          ], FileText)}
          {resourceSelect('firs_default_invoice_type_code', 'Default invoice type', 'invoice_types', { value: 'commercial_invoice', label: 'Commercial invoice' }, (v) => v.toLowerCase())}
          {resourceSelect('firs_default_payment_means_code', 'Default payment means', 'payment_means', { value: 'direct_transfer', label: 'Direct transfer' }, (v) => v.toLowerCase())}
          {resourceSelect('firs_default_tax_category_code', 'Default tax category', 'tax_categories', { value: 'VAT_STANDARD', label: 'Standard VAT' })}
          {select('invoice', 'firs_default_vat_exemption_code', 'Default VAT exemption', [
            { value: '', label: 'No default exemption' }, ...resourceOptions(resources.vat_exemptions, invoice.firs_default_vat_exemption_code ? { value: invoice.firs_default_vat_exemption_code, label: invoice.firs_default_vat_exemption_code } : null),
          ], Hash, { isSearchable: true })}
        </div>
        <div className={styles.switches}>{toggle('invoice', 'firs_auto_readiness_check', 'Auto-run local FIRS readiness after save', 'This flag is for local readiness checks, not external submission.')}</div>
        <div className={styles.actions}><Button type="submit" icon={Save} loading={saving === 'invoice'}>Save invoice defaults</Button></div>
      </form>
    </Panel>}

    {tab === 'compliance' && <Panel eyebrow="Internal readiness" title="Compliance profile" icon={ShieldCheck}
      description="Keep your tax identity and NRS issuer details ready for future integration.">
      <Alert tone="info" title="Not yet submitted to NRS" className={styles.notice}>
        NRS-issued identifiers are optional until assigned. Entering an identifier does not mean DigitalInvoice or your business is licensed, certified or live with NRS.
      </Alert>
      <form onSubmit={(event) => save('compliance', event)} noValidate>
        <div className={styles.grid}>
          {field('compliance', 'tax_identification_number', 'Tax Identification Number (TIN)', BadgeCheck, { required: true, maxLength: 60 })}
          {select('compliance', 'issuer_type', 'Issuer type', ISSUER_TYPES, Briefcase)}
          {select('compliance', 'business_registration_type', 'Registration type', REGISTRATION_TYPES, FileText)}
        </div>
        <div className={styles.switches}>{toggle('compliance', 'is_vat_registered', 'This business is VAT registered', 'Provide a VAT number if enabled.')}</div>
        {compliance.is_vat_registered && <div className={styles.grid}>{field('compliance', 'vat_number', 'VAT number', Hash, { required: true, maxLength: 60 })}</div>}
        <div className={styles.subheading}><h3>NRS issuer profile</h3><p>Use only issued IDs and applicable NRS address resource codes.</p></div>
        <div className={styles.grid}><NrsIssuerFields form={compliance} errors={errors.compliance} onChange={(name, value) => update('compliance', name, value)} idPrefix="settings" /></div>
        <dl className={styles.metadata}>
          <div><dt>NRS/MBS status</dt><dd>{labelStatus(nrsStatus.nrs_mbs_status)}</dd></div>
          <div><dt>Integration environment</dt><dd>{labelStatus(nrsStatus.integration_environment)}</dd></div>
        </dl>
        <div className={styles.confirm}>
          <Checkbox id="settings-compliance-confirmed" card checked={compliance.compliance_confirmed}
            onChange={(event) => update('compliance', 'compliance_confirmed', event.target.checked)}
            label="I confirm that this compliance information is accurate."
            description="The supplied tax and registration details will be used on business invoices."
            error={errors.compliance.compliance_confirmed} />
        </div>
        <div className={styles.actions}><Button type="submit" icon={CheckCircle2} loading={saving === 'compliance'}>Save compliance profile</Button></div>
      </form>
    </Panel>}

    {tab === 'banking' && <Panel eyebrow="Payment destination" title="Payment accounts" icon={Landmark}
      description="Manage bank accounts displayed on your business invoices.">
      <div className={styles.sectionAction}><Button icon={Plus} onClick={() => openBank(null)}>Add payment account</Button></div>
      {!accounts.length ? <div className={styles.empty}><Landmark size={25} /><h3>No payment accounts yet</h3><p>Add an account to show payment details on invoices.</p></div> :
        <div className={styles.accountGrid}>{accounts.map((account) => <article className={styles.account} key={account.id}>
          <div className={styles.accountHeading}><Landmark size={21} aria-hidden="true" />
            <strong>{account.bank_name}</strong>{bool(account.is_default) && <span className={styles.defaultTag}>Default</span>}</div>
          <p>{account.account_name}</p><p className="num">{account.account_number} · {account.currency}</p>
          <div className={styles.accountActions}>
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openBank(account)}>Edit</Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setBankDelete(account)}>Remove</Button>
          </div>
        </article>)}</div>}
    </Panel>}

    {tab === 'branding' && <Panel eyebrow="Document identity" title="Business logo" icon={ImagePlus}
      description="Upload the logo used on your business documents.">
      <div className={styles.branding}>
        <div className={styles.logoBox}>
          {logoUrl ? <img src={logoUrl} alt="Current organisation logo" /> : <ImagePlus size={36} aria-hidden="true" />}
        </div>
        <div className={styles.brandActions}>
          <p>PNG, JPG or WEBP, up to 2 MB. Keep your logo clear on a white document background.</p>
          <input ref={fileRef} className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} aria-label="Upload organisation logo" />
          <div className={styles.actionGroup}>
            <Button icon={Upload} disabled={saving === 'logo'} loading={saving === 'logo'} onClick={() => fileRef.current?.click()}>
              {logoAvailable ? 'Replace logo' : 'Upload logo'}
            </Button>
            {logoAvailable && <Button variant="danger" icon={Trash2} disabled={saving === 'logo'} onClick={removeLogo}>Remove logo</Button>}
          </div>
        </div>
      </div>
    </Panel>}

    <Drawer open={bankOpen} onClose={() => setBankOpen(false)} busy={saving === 'bank'}
      title={bankForm.id ? 'Edit payment account' : 'Add payment account'} eyebrow="Organisation settings"
      description="Account details can appear on new invoices."
      footer={<><Button variant="secondary" disabled={saving === 'bank'} onClick={() => setBankOpen(false)}>Cancel</Button>
        <Button type="submit" form="settings-bank-form" loading={saving === 'bank'} icon={Save}>Save account</Button></>}>
      <form id="settings-bank-form" onSubmit={saveBank} noValidate className={styles.drawerForm}>
        {field('bank', 'bank_name', 'Bank name', Landmark, { required: true, maxLength: 120, 'data-autofocus': true })}
        {field('bank', 'account_name', 'Account name', UserRound, { required: true, maxLength: 180 })}
        {field('bank', 'account_number', 'Account number', Hash, { required: true, inputMode: 'numeric', maxLength: 30 })}
        {select('bank', 'currency', 'Currency', CURRENCIES, Coins)}
        {toggle('bank', 'is_default', 'Default payment account', 'Preselect this account on invoices.')}
      </form>
    </Drawer>
    <ConfirmDialog open={Boolean(bankDelete)} title="Remove payment account?"
      message={`Remove ${bankDelete?.bank_name || 'this account'} from your available payment accounts? Existing invoices are not deleted.`}
      confirmLabel="Remove account" variant="danger" loading={saving === 'bank-delete'}
      onConfirm={removeBank} onClose={() => setBankDelete(null)} />
  </div>
}
