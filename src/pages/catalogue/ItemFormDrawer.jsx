import { useEffect, useMemo, useState } from 'react'
import { Barcode, Box, Coins, FileText, Package, Percent, Plus, RefreshCw, Ruler, Save, ShieldCheck, Tags, X } from 'lucide-react'
import Drawer from '../../components/overlays/Drawer'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import itemService from '../../services/itemService'
import referenceService from '../../services/referenceService'
import firsService from '../../services/firsService'
import useToastStore from '../../stores/useToastStore'
import { validateItemForm, validateCustomUnitForm } from '../../utils/validation'
import { getErrorMessage } from '../../utils/httpError'
import { ITEM_TYPES, ITEM_CURRENCIES, taxRateOptionLabel, unitOptionLabel } from './catalogueOptions'
import styles from './ItemFormDrawer.module.css'

// Keep the reference API's IDs intact. Some API versions return the list in a
// top-level array, while others wrap it under data.units (or data.data.units).
const recordsFrom = (response, key) => {
  const body = response?.data
  const payload = body?.data ?? body
  const candidates = [payload?.[key], body?.[key], payload?.data?.[key], payload]
  return candidates.find(Array.isArray) || []
}

// Show only units the backend will accept for the selected item type.
const unitsForType = (units, itemType) => {
  const matches = units.filter((unit) => {
    const category = String(unit.category || 'both').trim().toLowerCase()
    return category === itemType || category === 'both'
  })
  return matches
}

const blankUnit = { name: '', symbol: '', category: 'service' }

const blank = {
  item_type: 'service', item_code: '', name: '', description: '', unit_of_measure_id: '',
  default_unit_price: '', currency: 'NGN', tax_rate_id: '', discount_allowed: true,
  nrs_item_classification_code: '', firs_item_type: 'service', firs_tax_category_code: '',
  firs_vat_exemption_code: '', firs_unit_code: '', is_active: true,
}
const hydrate = (item, defaultCurrency) => item ? {
  ...blank, ...item,
  item_type: item.item_type || 'service',
  item_code: item.item_code || '', name: item.name || '', description: item.description || '',
  unit_of_measure_id: String(item.unit_of_measure_id || ''),
  default_unit_price: String(item.default_unit_price ?? ''),
  currency: item.currency || 'NGN', tax_rate_id: String(item.tax_rate_id || ''),
  discount_allowed: Boolean(Number(item.discount_allowed)),
  nrs_item_classification_code: item.nrs_item_classification_code || '',
  firs_item_type: item.firs_item_type || (item.item_type === 'product' ? 'goods' : 'service'),
  firs_tax_category_code: item.firs_tax_category_code || '',
  firs_vat_exemption_code: item.firs_vat_exemption_code || '', firs_unit_code: item.firs_unit_code || '',
  is_active: Boolean(Number(item.is_active)),
} : { ...blank, currency: defaultCurrency || 'NGN' }

export default function ItemFormDrawer({ open, item, defaultCurrency = 'NGN', onClose, onSaved }) {
  const toast = useToastStore((state) => state.showToast)
  const editing = Boolean(item?.id)
  const [form, setForm] = useState(() => hydrate(item, defaultCurrency))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [firsResources, setFirsResources] = useState({})
  const [classification, setClassification] = useState({ kind: '', verified: false, options: [], source: 'pending_license' })
  const [loadingClassification, setLoadingClassification] = useState(false)
  const [manualClassification, setManualClassification] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [loadingTaxRates, setLoadingTaxRates] = useState(false)
  const [unitsError, setUnitsError] = useState('')
  const [reloadingUnits, setReloadingUnits] = useState(false)
  const [showUnitCreator, setShowUnitCreator] = useState(false)
  const [unitForm, setUnitForm] = useState(blankUnit)
  const [unitErrors, setUnitErrors] = useState({})
  const [unitSubmitted, setUnitSubmitted] = useState(false)
  const [creatingUnit, setCreatingUnit] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let live = true
    setForm(hydrate(item, defaultCurrency))
    setErrors({})
    setSubmitted(false)
    setUnits([])
    setTaxRates([])
    setFirsResources({})
    setClassification({ kind: '', verified: false, options: [], source: 'pending_license' })
    setManualClassification(false)
    setUnitsError('')
    setShowUnitCreator(false)
    setUnitForm({ ...blankUnit, category: item?.item_type || 'service' })
    setUnitErrors({})
    setUnitSubmitted(false)
    setLoadingUnits(true)
    setLoadingTaxRates(true)

    // Fetch each reference independently. If tax rates or optional FIRS
    // resources fail, units can still populate normally.
    referenceService.units().then((response) => {
      if (!live) return
      const newUnits = recordsFrom(response, 'units')
      setUnits(newUnits)
      setUnitsError(newUnits.length === 0 ? 'empty' : '')
      // Never silently assign units; the backend resolves the generic Service
      // unit when a service is saved without an explicit choice.
    }).catch((error) => {
      if (!live) return
      setUnitsError('failed')
      toast(getErrorMessage(error, 'Unable to load units of measure.'), 'error', 'Units unavailable')
    }).finally(() => { if (live) setLoadingUnits(false) })

    referenceService.taxRates().then((response) => {
      if (!live) return
      const newTaxRates = recordsFrom(response, 'tax_rates')
      setTaxRates(newTaxRates)
      // Empty means use the organisation's current default tax treatment.
    }).catch((error) => {
      if (live) toast(getErrorMessage(error, 'Unable to load tax rates.'), 'error', 'Tax rates unavailable')
    }).finally(() => { if (live) setLoadingTaxRates(false) })

    firsService.options().then((response) => {
      if (live) setFirsResources(response?.data?.data?.resource_options || {})
    }).catch(() => { /* FIRS mappings are optional for this form. */ })
    return () => { live = false }
  }, [open, item, defaultCurrency, toast])

  // Classification resources are item-type-specific. Older saved manual codes
  // remain editable, but never become 'verified' merely because a list loaded.
  useEffect(() => {
    if (!open) return undefined
    let active = true
    const kind = form.item_type === 'product' ? 'goods' : 'service'
    setLoadingClassification(true)
    setClassification({ kind, verified: false, options: [], source: 'loading' })

    firsService.classificationCodes(kind)
      .then((response) => {
        if (!active) return
        const payload = response?.data?.data || {}
        const options = (Array.isArray(payload.options) ? payload.options : [])
          .filter((entry) => entry && String(entry.code || '').trim())
          .map((entry) => ({ code: String(entry.code), label: String(entry.label || entry.code) }))
        const verified = payload.verified === true
        setClassification({ kind, verified, options, source: payload.source || 'pending_license' })
      })
      .catch(() => {
        if (active) setClassification({ kind, verified: false, options: [], source: 'unavailable' })
      })
      .finally(() => { if (active) setLoadingClassification(false) })

    return () => { active = false }
  }, [open, form.item_type])

  // A retry must not reset form values the user has already entered.
  const retryUnitLoad = async () => {
    if (reloadingUnits) return
    setReloadingUnits(true)
    try {
      const response = await referenceService.units()
      const newUnits = recordsFrom(response, 'units')
      setUnits(newUnits)
      setUnitsError(newUnits.length === 0 ? 'empty' : '')
      // Never silently assign units; the backend resolves the generic Service
      // unit when a service is saved without an explicit choice.
    } catch (error) {
      setUnitsError('failed')
      toast(getErrorMessage(error, 'Unable to load units of measure.'), 'error', 'Units unavailable')
    } finally { setReloadingUnits(false) }
  }

  const availableUnits = useMemo(() => unitsForType(units, form.item_type).map((unit) => ({ value: String(unit.id), label: unitOptionLabel(unit) })), [units, form.item_type])
  const taxOptions = useMemo(() => taxRates.map((rate) => ({ value: String(rate.id), label: taxRateOptionLabel(rate) })), [taxRates])
  const classificationKind = form.item_type === 'product' ? 'goods' : 'service'
  const hasImportedCodes = classification.kind === classificationKind && classification.verified && classification.options.length > 0
  const showManualClassification = manualClassification || (hasImportedCodes && Boolean(form.nrs_item_classification_code)
    && !classification.options.some((entry) => entry.code === form.nrs_item_classification_code))
  const classificationOptions = useMemo(() => [
    { value: '', label: 'Select classification code' },
    ...classification.options.map((entry) => ({ value: entry.code, label: `${entry.code} — ${entry.label}` })),
  ], [classification.options])
  let classificationStatus = 'Pending official resource sync. Manual codes are unverified.'
  if (loadingClassification || classification.kind !== classificationKind) {
    classificationStatus = 'Loading classification resources…'
  } else if (hasImportedCodes) {
    classificationStatus = showManualClassification
      ? 'An imported code list is available, but this manual entry is unverified.'
      : 'Official-list data imported. Check that the selected code is current before use.'
  } else if (classification.verified) {
    classificationStatus = 'No active classification codes were returned. Manual codes are unverified.'
  } else if (classification.source === 'unavailable') {
    classificationStatus = 'Classification resources are unavailable. Manual codes are unverified.'
  }
  const optionList = (field) => (firsResources[field] || []).map((entry) => ({ value: entry.code || entry.value, label: entry.label || entry.code || entry.value }))
  const update = (key, value) => {
    const next = { ...form, [key]: value }
    if (key === 'item_type') {
      const nextUnits = unitsForType(units, value)
      const allowed = nextUnits.some((unit) => String(unit.id) === String(form.unit_of_measure_id))
      next.unit_of_measure_id = allowed ? form.unit_of_measure_id : ''
      next.firs_item_type = value === 'product' ? 'goods' : 'service'
      next.nrs_item_classification_code = ''
      setManualClassification(false)
      setShowUnitCreator(false)
      setUnitForm({ ...blankUnit, category: value })
      setUnitErrors({})
      setUnitSubmitted(false)
    }
    setForm(next)
    if (submitted) setErrors(validateItemForm(next))
  }
  const changeClassificationMode = (manual) => {
    if (manual === showManualClassification) return
    setManualClassification(manual)
    update('nrs_item_classification_code', '')
  }
  const submit = async (event) => {
    event.preventDefault()
    if (saving || creatingUnit) return
    const nextErrors = validateItemForm(form)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast('Check the highlighted product or service details before saving.', 'warning', 'Review required fields')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editing ? { id: item.id } : {}), ...form,
        unit_of_measure_id: form.unit_of_measure_id ? Number(form.unit_of_measure_id) : null,
        tax_rate_id: form.tax_rate_id ? Number(form.tax_rate_id) : null,
        default_unit_price: form.item_type === 'service' && !String(form.default_unit_price).trim()
          ? '0.00' : String(form.default_unit_price).replaceAll(',', ''),
      }
      const response = editing ? await itemService.update(payload) : await itemService.create(payload)
      toast(editing ? 'Catalogue record updated successfully.' : 'Product or service is ready for invoicing.', 'success', editing ? 'Item updated' : 'Item created')
      onSaved?.(response.data?.data?.item)
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to save this item.'), 'error', 'Could not save item')
    } finally { setSaving(false) }
  }

  const createUnit = async (event) => {
    event.preventDefault()
    if (creatingUnit || saving) return
    const nextErrors = validateCustomUnitForm(unitForm)
    setUnitSubmitted(true)
    setUnitErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setCreatingUnit(true)
    try {
      const response = await referenceService.createUnit({
        name: unitForm.name.trim(),
        symbol: unitForm.symbol.trim(),
        category: unitForm.category,
      })
      const unit = response?.data?.data?.unit
      if (!unit?.id) throw new Error('The server did not return the created unit.')
      setUnits((previous) => [...previous, unit])
      setUnitsError('')
      setForm((current) => {
        const valid = unit.category === 'both' || unit.category === current.item_type
        const updated = { ...current, unit_of_measure_id: valid ? String(unit.id) : current.unit_of_measure_id }
        if (submitted) setErrors(validateItemForm(updated))
        return updated
      })
      setUnitForm({ ...blankUnit, category: form.item_type })
      setShowUnitCreator(false)
      setUnitSubmitted(false)
      toast('Your unit is available for this workspace.', 'success', 'Unit created')
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to create the unit.'), 'error', 'Unit not created')
    } finally {
      setCreatingUnit(false)
    }
  }
  const toggleUnitCreator = () => {
    setShowUnitCreator((current) => !current)
    setUnitForm({ ...blankUnit, category: form.item_type })
    setUnitErrors({})
    setUnitSubmitted(false)
  }
  const updateUnit = (key, value) => {
    const next = { ...unitForm, [key]: value }
    setUnitForm(next)
    if (unitSubmitted) setUnitErrors(validateCustomUnitForm(next))
  }

  const text = (key, label, placeholder, icon, opts = {}) => <TextField id={`item-${key}`} label={label} icon={icon} size="md" value={form[key] ?? ''} error={errors[key]} onChange={(e) => update(key, opts.uppercase ? e.target.value.toUpperCase() : e.target.value)} placeholder={placeholder} autoComplete="off" {...(opts.inputMode ? { inputMode: opts.inputMode } : {})} />
  const select = (key, label, options, icon, extra = {}) => <Select id={`item-${key}`} label={label} icon={icon} size="md" value={form[key]} onChange={(value) => update(key, value)} options={options} error={errors[key]} {...extra} />

  return <Drawer open={open} onClose={onClose} busy={saving || creatingUnit} eyebrow="Billing catalogue" title={editing ? 'Edit product or service' : 'Add product or service'} description="Set prices and optional defaults for your invoice lines." footer={<><Button variant="secondary" disabled={saving || creatingUnit} onClick={onClose}>Cancel</Button><Button type="submit" form="catalogue-item-form" loading={saving} disabled={creatingUnit} icon={Save}>{editing ? 'Save changes' : 'Create item'}</Button></>}>
    <form id="catalogue-item-form" className={styles.form} onSubmit={submit} noValidate>
      <section className={styles.section}><h3>Item information</h3><div className={styles.grid}>
        {select('item_type', 'Item type *', ITEM_TYPES, Box)}
        {text('item_code', 'Item code', 'Auto-generated if blank', Barcode, { uppercase: true })}
        <div className={styles.span}>{text('name', 'Name *', 'Product or service name', Package)}</div>
        <div className={styles.span}><Textarea id="item-description" label="Description" rows={3} value={form.description} error={errors.description} onChange={(e) => update('description', e.target.value)} placeholder="Description shown during invoice preparation." /></div>
      </div></section>
      <section className={styles.section}><h3>Pricing and units</h3><div className={styles.grid}>
        <div className={styles.unitField}>
          {select('unit_of_measure_id', form.item_type === 'service' ? 'Unit of measure (optional)' : 'Unit of measure *', availableUnits, Ruler, {
            isSearchable: true, isClearable: form.item_type === 'service', isDisabled: loadingUnits || reloadingUnits,
            placeholder: loadingUnits || reloadingUnits ? 'Loading units...' : form.item_type === 'service' ? 'No unit specified' : 'Select unit',
            noOptionsMessage: () => unitsError === 'failed' ? 'Unable to load units' : unitsError === 'empty' ? 'No units configured' : 'No matching units',
          })}
          {unitsError && !loadingUnits && <div className={styles.unitNotice} role="status">
            <span>{unitsError === 'empty' ? 'No units available yet. You can create one below.' : 'Unable to load units of measure. Please retry.'}</span>
            <button type="button" onClick={retryUnitLoad} disabled={reloadingUnits}><RefreshCw size={13} aria-hidden="true" /> Retry</button>
          </div>}
          {form.item_type === 'service' && <p className={styles.unitHint}>Optional for services. When left blank, the standard Service unit is used internally for invoice calculations.</p>}
          <button type="button" className={styles.unitCreateToggle} onClick={toggleUnitCreator} disabled={saving || creatingUnit} aria-expanded={showUnitCreator} aria-controls="catalogue-custom-unit">
            {showUnitCreator ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {showUnitCreator ? 'Cancel new unit' : 'Create your own unit'}
          </button>
        </div>
        {select('currency', 'Currency *', ITEM_CURRENCIES, Coins, { isSearchable: true })}
        <div className={styles.span}>{text('default_unit_price', form.item_type === 'service' ? 'Default unit price (optional)' : 'Default unit price *', form.item_type === 'service' ? 'Leave blank for variable pricing' : '0.00', Coins, { inputMode: 'decimal' })}</div>
      </div>
      {showUnitCreator && <div id="catalogue-custom-unit" className={styles.customUnitPanel} role="group" aria-label="Create a custom unit of measure">
        <div className={styles.customUnitHeading}><strong>New unit of measure</strong><span>Only people in this workspace can use it.</span></div>
        <div className={styles.grid}>
          <TextField id="custom-unit-name" label="Unit name *" value={unitForm.name} maxLength={80} placeholder="e.g. Inspection visit" size="md" error={unitErrors.name} onChange={(event) => updateUnit('name', event.target.value)} autoComplete="off" />
          <TextField id="custom-unit-symbol" label="Symbol (optional)" value={unitForm.symbol} maxLength={16} placeholder="e.g. visit" size="md" error={unitErrors.symbol} onChange={(event) => updateUnit('symbol', event.target.value)} autoComplete="off" />
          <div className={styles.span}><Select id="custom-unit-category" label="Available for *" size="md" options={[{ value: form.item_type, label: form.item_type === 'service' ? 'Services' : 'Products' }, { value: 'both', label: 'Products and services' }]} value={unitForm.category} error={unitErrors.category} onChange={(value) => updateUnit('category', value)} /></div>
        </div>
        <p>Custom units are local catalogue values. They are not verified NRS unit codes.</p>
        <Button type="button" size="sm" icon={Plus} loading={creatingUnit} disabled={saving} onClick={createUnit}>Save and select unit</Button>
      </div>}
      </section>
      <section className={styles.section}><h3>Tax and compliance</h3><div className={styles.grid}>
        <div className={styles.span}>{select('tax_rate_id', 'Tax treatment (optional)', [{ value: '', label: 'Use workspace default' }, ...taxOptions], Percent, { isSearchable: true, isDisabled: loadingTaxRates, placeholder: loadingTaxRates ? 'Loading tax rates...' : 'Use workspace default' })}</div>
        <div className={`${styles.span} ${styles.classificationField}`}>
          {hasImportedCodes && !showManualClassification ? (
            select('nrs_item_classification_code', form.item_type === 'product' ? 'NRS HS goods code' : 'NRS service classification code', classificationOptions, ShieldCheck, { isSearchable: true })
          ) : (
            <TextField
              id="item-nrs_item_classification_code"
              label={form.item_type === 'product' ? 'Goods HS code (draft)' : 'Service classification code (draft)'}
              value={form.nrs_item_classification_code}
              onChange={(event) => update('nrs_item_classification_code', event.target.value.toUpperCase())}
              placeholder={loadingClassification || classification.kind !== classificationKind ? 'Loading codes…' : 'Optional until NRS code list is available'}
              icon={ShieldCheck}
              hint="Unverified manual code. Not proof of NRS classification."
              error={errors.nrs_item_classification_code}
              disabled={loadingClassification || classification.kind !== classificationKind}
              size="md"
              autoComplete="off"
            />
          )}
          {hasImportedCodes && (
            <button
              type="button"
              className={styles.classificationToggle}
              onClick={() => changeClassificationMode(!showManualClassification)}
              disabled={saving}
              aria-pressed={showManualClassification}
            >
              {showManualClassification ? 'Choose an imported code instead' : 'Enter an unverified code manually'}
            </button>
          )}
          <p className={styles.classificationStatus} role="status" aria-live="polite">
            <span>NRS code-list status</span>
            {classificationStatus} · {form.item_type === 'product' ? 'Goods (HS)' : 'Services'}
          </p>
        </div>
        {select('firs_item_type', 'FIRS item type', [{ value: 'goods', label: 'Goods' }, { value: 'service', label: 'Service' }], Package)}
        {select('firs_tax_category_code', 'FIRS tax category', [{ value: '', label: 'Use invoice/workspace default' }, ...optionList('tax_categories')], Percent, { isSearchable: true })}
        {select('firs_unit_code', 'FIRS unit code', [{ value: '', label: 'Use selected unit code' }, ...optionList('unit_codes')], Ruler, { isSearchable: true })}
        {select('firs_vat_exemption_code', 'VAT exemption mapping', [{ value: '', label: 'No exemption / not applicable' }, ...optionList('vat_exemptions')], Tags, { isSearchable: true })}
      </div><p className={styles.integrationNote}><FileText size={15} aria-hidden="true" />These mappings are local readiness defaults only. They will be synced with official FIRS/MBS resources once licensed access is available.</p></section>
      <section className={styles.section}><h3>Invoice availability</h3><Switch id="item-discount" label="Allow line discount" description="Let invoice preparers apply a discount to this item when permitted." checked={form.discount_allowed} onChange={(value) => update('discount_allowed', value)} />
        {editing && <Switch id="item-active" label="Active item" description="Inactive items remain recorded but are unavailable for new invoices." checked={form.is_active} onChange={(value) => update('is_active', value)} />}
      </section>
    </form>
  </Drawer>
}
