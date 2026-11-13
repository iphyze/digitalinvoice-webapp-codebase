import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, Globe2, MailCheck, RefreshCw, Save, Settings2, ShieldCheck, SlidersHorizontal, CalendarDays, WalletCards } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import PageLoader from '../../components/ui/PageLoader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import platformService from '../../services/platformService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { platformPermission } from '../../utils/platformPermissions'
import { getErrorMessage } from '../../utils/httpError'
import {
  buildPlatformSettingsPayload, normalizePlatformSettings, parsePlatformSettings,
  validatePlatformSettings,
} from './platformAccountModel'
import styles from './PlatformAccount.module.css'

const intervalOptions = [
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannually', label: 'Biannually (6 months)' }, { value: 'annually', label: 'Annually' },
]
const paystackOptions = [{ value: 'test', label: 'Test configuration' }, { value: 'live', label: 'Live configuration' }]
const environmentOptions = [{ value: 'sandbox', label: 'Sandbox preference' }, { value: 'production', label: 'Production preference' }]
const currencyOptions = ['NGN', 'USD', 'GBP', 'EUR'].map((value) => ({ value, label: value }))

function Panel({ icon: Icon, title, description, children }) {
  return <section className={styles.panel} aria-label={title}>
    <div className={styles.panelHeading}><span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
      <div><h2>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>
}

export default function PlatformSettings() {
  const user = useAuthStore((state) => state.user)
  const access = useAuthStore((state) => state.platformAccess)
  const canManage = platformPermission(access, user, 'platform.settings.manage')
  const toast = useToastStore((state) => state.showToast)
  const [payload, setPayload] = useState(null)
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const dirty = useMemo(() => Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)), [form, saved])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = parsePlatformSettings(await platformService.settings())
      const values = normalizePlatformSettings(next.settings)
      setPayload(next)
      setForm(values)
      setSaved(values)
      setErrors({})
      setSubmitted(false)
      setSubmitError('')
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to load platform settings.'))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const update = (key, value) => {
    if (!canManage || !payload?.settings_table_ready || saving) return
    const next = { ...form, [key]: value }
    setForm(next)
    if (submitted) setErrors(validatePlatformSettings(next))
    setSubmitError('')
  }

  const reset = () => {
    setForm({ ...saved })
    setErrors({})
    setSubmitted(false)
    setSubmitError('')
    setDiscarding(false)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!canManage || !payload?.settings_table_ready || saving || !dirty) return
    setSubmitted(true)
    const validation = validatePlatformSettings(form)
    setErrors(validation)
    if (Object.keys(validation).length) {
      setSubmitError('Review the highlighted fields before saving.')
      return
    }
    setSaving(true)
    setSubmitError('')
    try {
      const result = parsePlatformSettings(await platformService.updateSettings(buildPlatformSettingsPayload(form)))
      const values = normalizePlatformSettings(result.settings)
      setPayload(result)
      setForm(values)
      setSaved(values)
      setSubmitted(false)
      setErrors({})
      toast('Platform settings have been saved.', 'success', 'Settings saved')
    } catch (cause) {
      setSubmitError(getErrorMessage(cause, 'Unable to save platform settings.'))
    } finally { setSaving(false) }
  }

  const editDisabled = !canManage || !payload?.settings_table_ready || saving || loading
  const field = (key, label, options = {}) => (
    <TextField id={`platform-setting-${key}`} label={label} value={form?.[key] ?? ''}
      onChange={(event) => update(key, event.target.value)} disabled={editDisabled} error={errors[key]}
      maxLength={options.maxLength} required={options.required} inputMode={options.inputMode}
      placeholder={options.placeholder} hint={options.hint} type={options.type || 'text'} />
  )
  const chooser = (key, label, options) => (
    <Select id={`platform-setting-${key}`} label={label} options={options} value={form?.[key] || ''}
      onChange={(value) => update(key, value)} isDisabled={editDisabled} error={errors[key]} />
  )
  const switcher = (key, label, description) => (
    <Switch id={`platform-setting-${key}`} label={label} description={description} checked={Boolean(form?.[key])}
      disabled={editDisabled} onChange={(value) => update(key, value)} />
  )

  const gateway = payload?.gateway || {}
  const configured = [gateway.paystack_public_key_configured, gateway.paystack_secret_key_configured, gateway.paystack_webhook_secret_configured].filter(Boolean).length

  return <main className={styles.page}>
    <PageHeader eyebrow="Platform administration" title="Platform settings"
      description="Configure platform identity, contact routing, billing defaults and environment preferences."
      actions={<div className={styles.actions}>
        {canManage && dirty ? <Button variant="ghost" disabled={saving} onClick={() => setDiscarding(true)}>Discard changes</Button> : null}
        <Button variant="secondary" icon={RefreshCw} disabled={loading || saving || dirty} onClick={load} loading={loading && Boolean(payload)}>Refresh</Button>
        {canManage && payload?.settings_table_ready ? <Button icon={Save} onClick={save} disabled={!dirty || loading || saving} loading={saving}>Save settings</Button> : null}
      </div>} />
    {loading && !payload ? <PageLoader inline message="Loading platform settings…" /> : null}
    {error ? <Alert tone="danger" title="Settings unavailable">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert> : null}
    {payload && form ? <>
      {!payload.settings_table_ready ? <Alert tone="warning" title="Database setup required">
        The platform settings table is not installed. Current values are defaults. Run the backend migration
        <code> schemas/2026_06_01_add_platform_settings.sql</code> before saving configuration changes.
      </Alert> : null}
      {!canManage ? <Alert tone="info" title="View-only access">You may inspect settings, but only platform users with settings management permission can change them.</Alert> : null}
      {dirty ? <Alert tone="info" title="Unsaved changes">Save or discard your changes before refreshing this page.</Alert> : null}
      {submitError ? <Alert tone="danger" title="Settings not saved">{submitError}</Alert> : null}
      <div className={styles.stats} aria-label="Configuration overview">
        <SummaryStat icon={ShieldCheck} label="Active platform owners" value={payload.summary?.active_owners ?? '—'} />
        <SummaryStat icon={CreditCard} label="Paystack configuration checks" value={<>{configured}/3</>} />
        <SummaryStat icon={CalendarDays} label="Expiry warning window" value={<>{form.expiry_warning_days} days</>} />
        <SummaryStat icon={WalletCards} label="Default currency" value={form.default_currency} />
      </div>
      <form className={styles.sections} onSubmit={save} noValidate>
        <div className={styles.grid}>
          <Panel icon={Globe2} title="Platform identity" description="Public-facing identity and support contact information.">
            <div className={styles.fields}>
              {field('platform_name', 'Platform name', { required: true, maxLength: 120 })}
              {field('platform_tagline', 'Tagline', { maxLength: 190 })}
              {field('public_site_url', 'Public website URL', { maxLength: 190, placeholder: 'https://digitalinvoice.ng' })}
              {field('platform_phone', 'Support telephone', { maxLength: 40 })}
            </div>
          </Panel>
          <Panel icon={MailCheck} title="Contact routing" description="Emails used by owner, support, billing and compliance processes.">
            <div className={styles.fields}>
              {field('owner_email', 'Owner email', { required: true, maxLength: 190, type: 'email' })}
              {field('support_email', 'Support email', { required: true, maxLength: 190, type: 'email' })}
              {field('billing_email', 'Billing email', { required: true, maxLength: 190, type: 'email' })}
              {field('compliance_email', 'Compliance email', { required: true, maxLength: 190, type: 'email' })}
            </div>
          </Panel>
          <Panel icon={SlidersHorizontal} title="Subscription defaults" description="Defaults used by billing configuration and renewal reporting.">
            <div className={styles.fields}>
              {chooser('default_currency', 'Default currency', currencyOptions.some((option) => option.value === form.default_currency) || !/^[A-Z]{3}$/.test(form.default_currency) ? currencyOptions : [...currencyOptions, { value: form.default_currency, label: form.default_currency }])}
              {chooser('default_billing_interval', 'Default billing interval', intervalOptions)}
              {field('default_country', 'Country code', { required: true, maxLength: 2, placeholder: 'NG' })}
              <div className={styles.twoColumns}>
                {field('trial_days', 'Trial days', { inputMode: 'numeric' })}
                {field('grace_period_days', 'Grace period days', { inputMode: 'numeric' })}
              </div>
              {field('expiry_warning_days', 'Expiry warning days', { inputMode: 'numeric' })}
              {switcher('auto_suspend_expired', 'Flag expired subscriptions', 'An administrative configuration preference; subscription lifecycle actions remain server-controlled.')}
              {switcher('send_expiry_reminders', 'Prepare expiry reminders', 'This setting does not itself send emails. The backend controls reminder execution.')}
            </div>
          </Panel>
          <Panel icon={CreditCard} title="Payment gateway" description="Paystack preference and gateway configuration health.">
            <div className={styles.fields}>
              {chooser('paystack_mode', 'Saved Paystack mode', paystackOptions)}
              {field('paystack_public_key', 'Paystack public key', { maxLength: 190, placeholder: 'pk_test_… or pk_live_…' })}
              <dl className={styles.details}>
                <div><dt>Public key</dt><dd>{gateway.paystack_public_key_configured ? 'Configured' : 'Missing'}</dd></div>
                <div><dt>Secret key</dt><dd>{gateway.paystack_secret_key_configured ? 'Configured on server' : 'Not configured'}</dd></div>
                <div><dt>Webhook secret</dt><dd>{gateway.paystack_webhook_secret_configured ? 'Configured on server' : 'Not configured'}</dd></div>
                <div><dt>Mail transport</dt><dd>{gateway.mail_transport || '—'}</dd></div>
              </dl>
              <Alert tone="info">This saved preference does not verify gateway connectivity or change server-side secret keys. Configure secrets securely on the backend.</Alert>
            </div>
          </Panel>
          <Panel icon={ShieldCheck} title="Compliance defaults" description="Platform-wide defaults for documents and regulatory preparation.">
            <div className={styles.fields}>
              {field('default_vat_rate', 'Default VAT rate (%)', { inputMode: 'decimal' })}
              {chooser('compliance_environment', 'Saved compliance environment', environmentOptions)}
              <Alert tone="warning" title="Not yet submitted to NRS">
                An environment preference does not activate NRS production access, certification, licensing or live submission.
                Official evidence requires a separately verified production submission. NRS sandbox integration controls are managed in the dedicated integration screen.
              </Alert>
            </div>
          </Panel>
          <Panel icon={Settings2} title="System information" description="Backend-supplied configuration status; these values cannot be changed here.">
            <dl className={styles.details}>
              <div><dt>Configured frontend URL</dt><dd>{gateway.frontend_url || '—'}</dd></div>
              <div><dt>Settings storage</dt><dd>{payload.settings_table_ready ? 'Available' : 'Migration required'}</dd></div>
              <div><dt>Generated at</dt><dd>{payload.generated_at || '—'}</dd></div>
              <div><dt>Default country</dt><dd>{form.default_country || '—'}</dd></div>
            </dl>
          </Panel>
        </div>
        {canManage && payload.settings_table_ready ? <div className={styles.footer}>
          <span>Review configuration changes before applying them to the platform.</span>
          <Button icon={Save} type="submit" loading={saving} disabled={loading || !dirty}>Save settings</Button>
        </div> : null}
      </form>
    </> : null}
    <ConfirmDialog open={discarding} title="Discard unsaved changes?"
      message="All unsaved platform settings edits will be lost."
      confirmLabel="Discard changes" variant="danger" onClose={() => setDiscarding(false)} onConfirm={reset} />
  </main>
}
