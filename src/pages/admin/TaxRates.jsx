import { useCallback, useEffect, useMemo, useState } from 'react'
import { Percent, Plus, RefreshCw, CheckCircle2 } from 'lucide-react'
import SummaryStat from '../../components/data/SummaryStat'
import PageHeader from '../../components/shell/PageHeader'
import DataTable from '../../components/data/DataTable'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import Modal from '../../components/overlays/Modal'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import referenceService from '../../services/referenceService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission } from '../../utils/entitlements'
import { getErrorMessage } from '../../utils/httpError'
import { TAX_TREATMENTS, asBoolean, formatTaxRatePercent, taxRateForm, taxRatePayload, validateTaxRate } from './taxRateModel'
import styles from './AdminRegister.module.css'

export default function TaxRates() {
  const permissions = useAuthStore((state) => state.permissions)
  const entitlements = useAuthStore((state) => state.entitlements)
  const toast = useToastStore((state) => state.showToast)
  const canManage = hasPermission(permissions, 'tax_rates.manage') && hasEntitledPermission(entitlements, 'tax_rates.manage')
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [target, setTarget] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await referenceService.taxRates({ ...(canManage ? { include_inactive: 1 } : {}) })
      if (!Array.isArray(response?.data?.data?.tax_rates)) throw new Error('Tax rate response was incomplete.')
      setRates(response.data.data.tax_rates)
    } catch (err) { setError(getErrorMessage(err, 'Unable to load tax rates.')) }
    finally { setLoading(false) }
  }, [canManage])
  useEffect(() => { load() }, [load])
  const filtered = useMemo(() => rates.filter((rate) => (showInactive || asBoolean(rate.is_active))
    && `${rate.code} ${rate.name} ${rate.treatment}`.toLowerCase().includes(search.trim().toLowerCase())), [rates, showInactive, search])
  const enabledCount = rates.filter((r) => asBoolean(r.is_active)).length
  const open = (item) => { setForm(taxRateForm(item)); setErrors({}); setActionError('') }
  const update = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'treatment' && value !== 'standard') next.rate_percent = '0'
      if (key === 'is_active' && !value) next.is_default = false
      return next
    })
    if (Object.keys(errors).length) setErrors({})
  }
  const save = async (event) => {
    event.preventDefault()
    const issues = validateTaxRate(form)
    setErrors(issues)
    if (Object.keys(issues).length) return
    setBusy(true); setActionError('')
    try {
      if (form.id) await referenceService.updateTaxRate(taxRatePayload(form))
      else await referenceService.createTaxRate(taxRatePayload(form))
      toast(form.id ? 'Tax rate updated successfully.' : 'Tax rate created successfully.', 'success')
      setForm(null)
      await load()
    } catch (err) { setActionError(getErrorMessage(err, 'Unable to save tax rate.')) }
    finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (!target) return
    setBusy(true); setActionError('')
    try {
      await referenceService.updateTaxRate(taxRatePayload({ ...taxRateForm(target), is_active: false, is_default: false }))
      toast('Tax rate deactivated successfully.', 'success')
      setTarget(null)
      await load()
    } catch (err) { setActionError(getErrorMessage(err, 'Tax rate could not be deactivated.')) }
    finally { setBusy(false) }
  }
  const treatmentLabel = (v) => TAX_TREATMENTS.find((t) => t.value === v)?.label || v
  const actions = (item) => <div className={styles.rowActions}>
    <Button variant="secondary" size="sm" onClick={() => open(item)}>Edit</Button>
    {asBoolean(item.is_active) && !asBoolean(item.is_default) && <Button variant="danger" size="sm" onClick={() => { setTarget(item); setActionError('') }}>Deactivate</Button>}
  </div>
  const columns = [
    { key: 'code', header: 'Tax code', cell: (r) => <span className={`${styles.ellipsisText} ref`} title={r.code}>{r.code}</span> },
    { key: 'name', header: 'Name', cell: (r) => <div className={styles.rowTitle}><strong title={r.name}>{r.name}</strong><span title={r.description || 'No description'}>{r.description || 'No description'}</span></div> },
    { key: 'treatment', header: 'Treatment', cell: (r) => <span className={styles.ellipsisText} title={treatmentLabel(r.treatment)}>{treatmentLabel(r.treatment)}</span> },
    { key: 'percentage', header: 'Rate', cell: (r) => <span className="num">{formatTaxRatePercent(r.rate_percent)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <div className={styles.rowActions}><StatusBadge status={asBoolean(r.is_active) ? 'active' : 'inactive'} />{asBoolean(r.is_default) && <StatusBadge status="default" tone="info" label="Default" />}</div> },
  ]
  return <main className={styles.page}>
    <PageHeader eyebrow="Workspace administration" title="Tax rates" description="Maintain the tax treatments offered when creating catalogue items and invoices." actions={<div className={styles.actions}>
      <Button icon={RefreshCw} variant="secondary" disabled={loading || busy} onClick={load}>Refresh</Button>
      {canManage && <Button icon={Plus} onClick={() => open(null)}>Add tax rate</Button>}
    </div>} />
    <Alert tone="info" title="Tax rate configuration">These are internal invoice and catalogue settings. They do not mean that tax has been remitted or NRS submission approved.</Alert>
    {error ? <Alert tone="danger" title="Unable to load tax rates">{error} <Button variant="secondary" size="sm" onClick={load}>Try again</Button></Alert> : <>
      <div className={styles.stats}><SummaryStat icon={Percent} label="Total configured" value={loading ? '—' : rates.length} /><SummaryStat icon={CheckCircle2} label="Active tax rates" value={loading ? '—' : enabledCount} tone="green" /></div>
      <section className={styles.panel}>
        <div className={styles.filters}><TextField className={styles.search} label="Search tax rates" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, name or treatment" />
          {canManage && <Select label="Show rates" isSearchable={false} value={showInactive ? 'all' : 'active'} onChange={(value) => setShowInactive(value === 'all')} options={[{ value: 'active', label: 'Active only' }, { value: 'all', label: 'Include inactive' }]} />}
        </div>
        <DataTable columns={columns} rows={filtered} loading={loading} actions={canManage ? actions : undefined} empty={<div className={styles.empty}><Percent size={24} aria-hidden="true" /><h3>No tax rates found</h3><p>Try another search or create a tax rate if you have permission.</p></div>} />
      </section>
    </>}
    <Modal open={Boolean(form)} onClose={() => !busy && setForm(null)} title={form?.id ? 'Edit tax rate' : 'Add tax rate'} description="The backend will validate the treatment and applied percentage." busy={busy} footer={<div className={styles.footer}><Button variant="secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button type="submit" form="tax-rate-form" loading={busy}>Save tax rate</Button></div>}>
      {form && <form id="tax-rate-form" className={styles.form} onSubmit={save} noValidate>
        <div className={styles.formGrid}>
          <TextField label="Code" value={form.code} maxLength={40} error={errors.code} onChange={(e) => update('code', e.target.value)} required />
          <TextField label="Name" value={form.name} maxLength={100} error={errors.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <TextField label="Description (optional)" value={form.description} maxLength={255} error={errors.description} onChange={(e) => update('description', e.target.value)} />
        <div className={styles.formGrid}><Select label="Treatment" value={form.treatment} options={TAX_TREATMENTS} error={errors.treatment} onChange={(value) => update('treatment', value)} />
          <TextField label="Rate (%)" type="number" inputMode="decimal" min="0" max="100" step="0.0001" value={form.rate_percent} error={errors.rate_percent} disabled={form.treatment !== 'standard'} onChange={(e) => update('rate_percent', e.target.value)} />
        </div>
        <Switch checked={form.is_default} onChange={(value) => update('is_default', value)} label="Default tax rate" description="Use this rate by default on eligible new items." disabled={!form.is_active} />
        <Switch checked={form.is_active} onChange={(value) => update('is_active', value)} label="Active" description="Inactive rates cannot be selected for new items." />
        {errors.is_default && <p className={styles.formError}>{errors.is_default}</p>}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </form>}
    </Modal>
    <ConfirmDialog open={Boolean(target)} onClose={() => !busy && setTarget(null)} onConfirm={deactivate} loading={busy} title="Deactivate tax rate?" confirmLabel="Deactivate" variant="danger" message={target ? `Deactivate ${target.name}? Products or services that still use it must be reassigned first. Existing documents are preserved.` : ''} />
    {target && actionError && <Alert tone="danger">{actionError}</Alert>}
  </main>
}
