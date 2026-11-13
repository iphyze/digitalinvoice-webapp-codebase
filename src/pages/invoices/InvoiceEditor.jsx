import { addDays, format } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, BadgeCheck, Building2, Calculator, CheckCircle2, CirclePlus, Coins, FileText, Info, Package, Percent, Plus, Save, ShieldCheck, Trash2, WalletCards } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import Switch from '../../components/forms/Switch'
import CustomerFormDrawer from '../customers/CustomerFormDrawer'
import ItemFormDrawer from '../catalogue/ItemFormDrawer'
import InvoicePaymentAccountDrawer from './InvoicePaymentAccountDrawer'
import customerService from '../../services/customerService'
import itemService from '../../services/itemService'
import invoiceService from '../../services/invoiceService'
import onboardingService from '../../services/onboardingService'
import referenceService from '../../services/referenceService'
import firsService from '../../services/firsService'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { formatCurrency } from '../../utils/formatters'
import { readInvoiceCalculation, readInvoiceId, readInvoiceRecord } from '../../utils/apiPayload'
import { calculateInvoicePreview, getCompletedInvoiceLines } from '../../utils/invoiceCalculationPreview'
import {
  DISCOUNT_TYPES, INVOICE_CURRENCIES, FIRS_TRANSACTION_TYPES, FIRS_DOCUMENT_TYPES,
  FIRS_INVOICE_TYPES, FIRS_PAYMENT_MEANS, suggestedFirsDocumentType, asResourceOptions,
} from './invoiceEditorOptions'
import { invoiceLineClassification } from './invoiceLineClassification'
import styles from './InvoiceEditor.module.css'

const dateToday = () => format(new Date(), 'yyyy-MM-dd')
let nextKey = 0
const newLine = () => ({ key: `new-${++nextKey}`, item_id: '', description: '', quantity: '1', unit_price: '', discount_type: 'none', discount_value: '0', tax_rate_id: '' })
const blank = () => ({
  customer_id: '', invoice_date: dateToday(), due_date: '', currency: 'NGN', subject: '', reference: '',
  purchase_order_number: '', bank_account_id: '', discount_type: 'none', discount_value: '0',
  notes: '', terms_and_conditions: '', footer_note: '', payment_instructions: '', pay_now_enabled: false,
  firs_transaction_type: 'b2b', firs_document_type: 'tax_invoice', firs_invoice_type_code: 'commercial_invoice',
  firs_payment_means_code: 'direct_transfer', firs_tax_exemption_code: '', items: [newLine()],
})
const fromInvoice = (invoice) => ({
  ...blank(),
  customer_id: String(invoice.customer_id || ''),
  invoice_date: invoice.invoice_date || dateToday(), due_date: invoice.due_date || '',
  currency: invoice.currency || 'NGN', subject: invoice.subject || '', reference: invoice.reference || '',
  purchase_order_number: invoice.purchase_order_number || '', bank_account_id: String(invoice.bank_account_id || ''),
  discount_type: invoice.discount_type || 'none', discount_value: invoice.discount_type === 'none' ? '0' : String(invoice.discount_value ?? '0'),
  notes: invoice.notes || '', terms_and_conditions: invoice.terms_and_conditions || '', footer_note: invoice.footer_note || '',
  payment_instructions: invoice.payment_instructions || '', pay_now_enabled: Boolean(Number(invoice.pay_now_enabled)),
  firs_transaction_type: invoice.firs_transaction_type || 'b2b',
  firs_document_type: invoice.firs_document_type || suggestedFirsDocumentType(invoice.firs_transaction_type || 'b2b'),
  firs_invoice_type_code: invoice.firs_invoice_type_code || 'commercial_invoice',
  firs_payment_means_code: invoice.firs_payment_means_code || 'direct_transfer',
  firs_tax_exemption_code: invoice.firs_tax_exemption_code || '',
  items: Array.isArray(invoice.items) && invoice.items.length ? invoice.items.map((line) => ({
    key: `record-${line.id || ++nextKey}-${++nextKey}`,
    item_id: String(line.item_id || ''), description: line.item_description_snapshot || '',
    quantity: String(line.quantity ?? '1'), unit_price: String(line.unit_price ?? ''),
    discount_type: line.discount_type || 'none',
    discount_value: line.discount_type === 'none' ? '0' : String(line.discount_value ?? '0'),
    tax_rate_id: String(line.tax_rate_id || ''),
    // The backend owns these immutable *saved* values. On a subsequent draft
    // save it will snapshot the catalogue again, not accept client overrides.
    has_saved_snapshot: true,
    nrs_item_classification_snapshot: line.nrs_item_classification_snapshot || '',
    firs_item_type_snapshot: line.firs_item_type_snapshot || '',
  })) : [newLine()],
})
const moneyValue = (value) => String(value ?? '').replaceAll(',', '').trim()
const mergeById = (records, saved) => saved?.id ? [saved, ...records.filter((record) => String(record.id) !== String(saved.id))] : records
const money = (value, currency) => { try { return formatCurrency(value, currency) } catch { return `${currency} ${Number(value || 0).toLocaleString('en-NG')}` } }
const fieldOptions = (entries, getLabel) => entries.map((entry) => ({ value: String(entry.id), label: getLabel(entry) }))

function QuickAdd({ onClick, label, disabled }) {
  return <button type="button" className={styles.quickAdd} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Plus size={17} strokeWidth={2.2} aria-hidden="true" /></button>
}
function Panel({ icon: Icon, eyebrow, title, description, children, aside }) {
  return <section className={styles.panel}>
    <header className={styles.panelHeader}><span className={styles.panelIcon}><Icon size={18} aria-hidden="true" /></span><div className={styles.panelHeading}>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</header>
    <div className={styles.panelBody}>{children}</div>
  </section>
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.showToast)
  const customerDefault = params.get('customer')
  const itemDefault = params.get('item')
  const [form, setForm] = useState(blank)
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [accounts, setAccounts] = useState([])
  const [firsOptions, setFirsOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [calcError, setCalcError] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false)
  const [itemDrawerLine, setItemDrawerLine] = useState(null)
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    Promise.all([
      customerService.list({ status: 'active', limit: 100 }), itemService.list({ status: 'active', limit: 100 }),
      referenceService.taxRates(), onboardingService.getBankAccounts(), onboardingService.getInvoiceSettings(),
      firsService.options().catch(() => null), editing ? invoiceService.show(id) : Promise.resolve(null),
    ]).then(([customerResponse, itemResponse, taxResponse, bankResponse, settingsResponse, firsResponse, invoiceResponse]) => {
      if (!active) return
      const nextCustomers = customerResponse.data?.data?.customers || []
      const nextItems = itemResponse.data?.data?.items || []
      const nextTaxes = taxResponse.data?.data?.tax_rates || []
      const nextAccounts = bankResponse.data?.data?.bank_accounts || []
      const settings = settingsResponse.data?.data?.settings || {}
      setCustomers(nextCustomers)
      setItems(nextItems)
      setTaxRates(nextTaxes)
      setAccounts(nextAccounts)
      setFirsOptions(firsResponse?.data?.data?.resource_options || {})
      if (editing) {
        const invoice = readInvoiceRecord(invoiceResponse)
        if (!invoice || !['draft', 'rejected'].includes(invoice.status)) throw new Error('Only draft or returned invoices can be edited.')
        setForm(fromInvoice(invoice))
      } else {
        const selectedItem = nextItems.find((item) => String(item.id) === String(itemDefault))
        const terms = Number(settings.default_payment_terms_days || 30)
        setForm({
          ...blank(),
          customer_id: nextCustomers.some((customer) => String(customer.id) === String(customerDefault)) ? String(customerDefault) : '',
          due_date: format(addDays(new Date(), Number.isFinite(terms) ? terms : 30), 'yyyy-MM-dd'),
          currency: selectedItem?.currency || settings.default_currency || 'NGN',
          footer_note: settings.invoice_footer_note || '', payment_instructions: settings.payment_instructions || '',
          firs_transaction_type: settings.firs_default_transaction_type || 'b2b',
          firs_document_type: settings.firs_default_document_type || suggestedFirsDocumentType(settings.firs_default_transaction_type || 'b2b'),
          firs_invoice_type_code: settings.firs_default_invoice_type_code || 'commercial_invoice',
          firs_payment_means_code: settings.firs_default_payment_means_code || 'direct_transfer',
          firs_tax_exemption_code: settings.firs_default_vat_exemption_code || '',
          items: selectedItem ? [{ ...newLine(), item_id: String(selectedItem.id), description: selectedItem.description || '', unit_price: String(selectedItem.default_unit_price ?? ''), tax_rate_id: String(selectedItem.tax_rate_id || '') }] : [newLine()],
        })
      }
      setErrors({})
    }).catch((error) => { if (active) setLoadError(getErrorMessage(error, error.message || 'Unable to prepare the invoice form.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, id, customerDefault, itemDefault, retry])

  const toPayload = useCallback((draft = form) => ({
    ...(editing ? { id: Number(id) } : {}),
    customer_id: Number(draft.customer_id), invoice_date: draft.invoice_date, due_date: draft.due_date,
    currency: draft.currency, subject: draft.subject.trim() || null, reference: draft.reference.trim() || null,
    purchase_order_number: draft.purchase_order_number.trim() || null,
    bank_account_id: draft.bank_account_id ? Number(draft.bank_account_id) : null,
    discount_type: draft.discount_type, discount_value: draft.discount_type === 'none' ? '0' : moneyValue(draft.discount_value),
    notes: draft.notes.trim() || null, terms_and_conditions: draft.terms_and_conditions.trim() || null,
    footer_note: draft.footer_note.trim() || null, payment_instructions: draft.payment_instructions.trim() || null,
    pay_now_enabled: Boolean(draft.pay_now_enabled), firs_transaction_type: draft.firs_transaction_type,
    firs_document_type: draft.firs_document_type, firs_invoice_type_code: draft.firs_invoice_type_code,
    firs_payment_means_code: draft.firs_payment_means_code,
    firs_tax_exemption_code: draft.firs_tax_exemption_code.trim() || null,
    items: draft.items.map((line) => ({
      item_id: Number(line.item_id), description: line.description.trim() || null,
      quantity: moneyValue(line.quantity), unit_price: moneyValue(line.unit_price),
      discount_type: line.discount_type, discount_value: line.discount_type === 'none' ? '0' : moneyValue(line.discount_value),
      tax_rate_id: Number(line.tax_rate_id),
    })),
  }), [editing, form, id])

  const eligibleItems = useMemo(() => items.filter((item) => item.currency === form.currency), [items, form.currency])
  const customerChoices = useMemo(() => fieldOptions(customers, (c) => `${c.name} — ${c.customer_code || 'Customer'}`), [customers])
  const itemChoices = useMemo(() => fieldOptions(eligibleItems, (item) => `${item.name} — ${money(item.default_unit_price, item.currency)}`), [eligibleItems])
  const taxChoices = useMemo(() => fieldOptions(taxRates, (t) => `${t.name} — ${Number(t.rate_percent || 0).toFixed(2)}%`), [taxRates])
  const accountChoices = useMemo(() => fieldOptions(accounts.filter((a) => Number(a.is_active) && a.currency === form.currency), (a) => `${a.bank_name} — ${a.account_number} (${a.currency})`), [accounts, form.currency])
  const linesComplete = useMemo(() => getCompletedInvoiceLines(form.items).filter((line) => eligibleItems.some((item) => String(item.id) === String(line.item_id))), [form.items, eligibleItems])
  const live = useMemo(() => calculateInvoicePreview({ lines: linesComplete, taxRates, discountType: form.discount_type, discountValue: form.discount_value }), [linesComplete, taxRates, form.discount_type, form.discount_value])
  const ready = Boolean(form.customer_id && form.invoice_date && form.due_date && linesComplete.length)
  const calcSignature = JSON.stringify({ ...toPayload({ ...form, items: linesComplete }) })

  useEffect(() => {
    if (!ready || loading) {
      setCalculation(null)
      setCalcError('')
      setCalculating(false)
      return undefined
    }
    let active = true
    setCalcError('')
    setCalculating(false)
    const handle = window.setTimeout(async () => {
      setCalculating(true)
      setCalcError('')
      try {
        const response = await invoiceService.calculate(toPayload({ ...form, items: linesComplete }))
        const result = readInvoiceCalculation(response)
        if (!result?.totals) throw new Error('The server did not return calculated invoice totals.')
        if (active) setCalculation({ signature: calcSignature, totals: result.totals })
      } catch (error) {
        if (active) { setCalculation(null); setCalcError(getErrorMessage(error, error.message || 'Totals cannot be calculated yet.')) }
      } finally { if (active) setCalculating(false) }
    }, 260)
    return () => { active = false; window.clearTimeout(handle) }
  }, [calcSignature, ready, loading]) // Request signature tracks every payload input; ignore stale responses.

  const verifiedTotals = calculation?.signature === calcSignature && ready ? calculation.totals : null
  const totals = verifiedTotals || live?.totals
  const update = (key, value) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value }
      if (key === 'firs_transaction_type') next.firs_document_type = suggestedFirsDocumentType(value)
      if (key === 'firs_payment_means_code' && value !== 'firs_pay_now') next.pay_now_enabled = false
      if (key === 'currency') next.bank_account_id = ''
      if (key === 'discount_type' && value === 'none') next.discount_value = '0'
      return next
    })
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }
  const updateLine = (index, key, value) => {
    setForm((previous) => {
      const next = [...previous.items]
      const line = { ...next[index], [key]: value }
      if (key === 'item_id') {
        if (String(next[index].item_id) !== String(value)) {
          line.has_saved_snapshot = false
          line.nrs_item_classification_snapshot = ''
          line.firs_item_type_snapshot = ''
        }
        const item = items.find((entry) => String(entry.id) === String(value))
        line.description = item?.description || ''
        line.unit_price = String(item?.default_unit_price ?? '')
        line.tax_rate_id = String(item?.tax_rate_id || '')
        if (!Number(item?.discount_allowed)) { line.discount_type = 'none'; line.discount_value = '0' }
      }
      if (key === 'discount_type' && value === 'none') line.discount_value = '0'
      next[index] = line
      return { ...previous, items: next }
    })
    setErrors((previous) => ({ ...previous, [`items.${index}.${key}`]: undefined }))
  }
  const addLine = () => setForm((previous) => ({ ...previous, items: [...previous.items, newLine()] }))
  const removeLine = (index) => {
    if (form.items.length <= 1) return
    setForm((previous) => ({ ...previous, items: previous.items.filter((_, i) => i !== index) }))
    setErrors({}) // Index-keyed field errors must not be attached to a different row.
  }
  const customerSaved = (customer) => {
    if (!customer?.id) return
    setCustomers((current) => mergeById(current, customer))
    update('customer_id', String(customer.id))
    setCustomerDrawerOpen(false)
  }
  const itemSaved = (item) => {
    if (!item?.id) return
    setItems((current) => mergeById(current, item))
    if (item.currency !== form.currency) {
      toast(`The new item was saved in ${item.currency}. Select it when preparing an invoice in that currency.`, 'info', 'Item saved')
      setItemDrawerLine(null)
      return
    }
    if (itemDrawerLine !== null) {
      setForm((previous) => {
        if (!previous.items[itemDrawerLine]) return previous
        const next = [...previous.items]
        next[itemDrawerLine] = { ...next[itemDrawerLine], item_id: String(item.id), description: item.description || '',
          has_saved_snapshot: false, nrs_item_classification_snapshot: '', firs_item_type_snapshot: '',
          unit_price: String(item.default_unit_price ?? ''), tax_rate_id: String(item.tax_rate_id || ''),
          ...(!Number(item.discount_allowed) ? { discount_type: 'none', discount_value: '0' } : {}) }
        return { ...previous, items: next }
      })
      setErrors((previous) => ({ ...previous, [`items.${itemDrawerLine}.item_id`]: undefined }))
    }
    setItemDrawerLine(null)
  }
  const accountSaved = (bankAccounts, saved) => {
    setAccounts(bankAccounts)
    if (saved?.id && saved.currency === form.currency) update('bank_account_id', String(saved.id))
    setAccountDrawerOpen(false)
  }
  const validate = () => {
    const next = {}
    if (!form.customer_id) next.customer_id = 'Select the customer receiving this invoice.'
    if (!form.invoice_date) next.invoice_date = 'Select an invoice date.'
    if (!form.due_date) next.due_date = 'Select a payment due date.'
    if (form.due_date && form.invoice_date && form.due_date < form.invoice_date) next.due_date = 'Due date cannot be before the invoice date.'
    form.items.forEach((line, index) => {
      if (!line.item_id || !eligibleItems.some((item) => String(item.id) === line.item_id)) next[`items.${index}.item_id`] = 'Select a product or service for this currency.'
      const quantity = Number(moneyValue(line.quantity))
      const price = Number(moneyValue(line.unit_price))
      if (!line.quantity || !Number.isFinite(quantity) || quantity <= 0) next[`items.${index}.quantity`] = 'Enter a valid quantity.'
      if (line.unit_price === '' || !Number.isFinite(price) || price < 0) next[`items.${index}.unit_price`] = 'Enter a valid unit price.'
      if (!line.tax_rate_id) next[`items.${index}.tax_rate_id`] = 'Select a tax treatment.'
      if (line.discount_type !== 'none') {
        const value = Number(moneyValue(line.discount_value))
        if (!Number.isFinite(value) || value < 0 || (line.discount_type === 'percentage' && value > 100)) next[`items.${index}.discount_value`] = 'Enter a valid discount.'
      }
    })
    if (form.discount_type !== 'none') {
      const value = Number(moneyValue(form.discount_value))
      if (!Number.isFinite(value) || value < 0 || (form.discount_type === 'percentage' && value > 100)) next.discount_value = 'Enter a valid discount.'
    }
    setErrors(next)
    return !Object.keys(next).length
  }
  const saveDraft = async () => {
    if (saving) return
    if (!validate()) { toast('Review the highlighted invoice fields before saving.', 'warning', 'Required details missing'); return }
    setSaving(true)
    try {
      const response = editing ? await invoiceService.update(toPayload()) : await invoiceService.create(toPayload())
      const savedId = readInvoiceId(response)
      if (!savedId) throw new Error('The server did not return a saved invoice record. The draft has not been confirmed.')
      const checked = readInvoiceRecord(await invoiceService.show(savedId))
      if (!checked?.id) throw new Error('The saved invoice could not be reloaded from the server. The draft has not been confirmed.')
      toast(editing ? 'Invoice draft updated successfully.' : 'Invoice draft created successfully.', 'success', editing ? 'Draft updated' : 'Draft saved')
      navigate(`/app/invoices/${checked.id}`, { replace: true })
    } catch (error) {
      toast(getErrorMessage(error, error.message || 'Unable to save this invoice draft.'), 'error', 'Invoice not saved')
    } finally { setSaving(false) }
  }
  if (loading) return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div>
  if (loadError) return <div className={styles.errorState} role="alert"><AlertCircle size={27} /><h2>Invoice form unavailable</h2><p>{loadError}</p><div className={styles.errorActions}><Button onClick={() => setRetry((n) => n + 1)}>Try again</Button><Button to="/app/invoices" variant="secondary">Return to invoices</Button></div></div>

  const firsInvoiceTypes = asResourceOptions(firsOptions.invoice_types || [], true)
  const firsPaymentMeans = asResourceOptions(firsOptions.payment_means || [], true)
  const exemptionOptions = [{ value: '', label: 'No exemption / not applicable' }, ...asResourceOptions(firsOptions.vat_exemptions || [])]
  const input = (key, label, placeholder, icon, extra = {}) => <TextField id={`invoice-${key}`} size="md" label={label} icon={icon} value={form[key]} error={errors[key]} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} autoComplete="off" {...extra} />
  const select = (key, label, options, icon, extra = {}) => <Select id={`invoice-${key}`} size="md" label={label} icon={icon} options={options} value={form[key]} onChange={(value) => update(key, value)} error={errors[key]} {...extra} />

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.breadcrumb}><Link to="/app/invoices"><ArrowLeft size={14} /> Invoices</Link><span>/</span><span>{editing ? 'Edit invoice' : 'Create invoice'}</span></div>
    <PageHeader eyebrow={editing ? 'Update draft' : 'New sales document'} title={editing ? 'Edit invoice draft' : 'Create invoice'}
      description="Prepare invoice information, add billable items, and save as a draft."
      actions={<div className={styles.headerActions}><Button variant="secondary" to="/app/invoices">Cancel</Button><Button icon={Save} onClick={saveDraft} loading={saving}>{editing ? 'Save draft changes' : 'Save draft'}</Button></div>} />
    <div className={styles.layout}>
      <main className={styles.main}>
        <Panel icon={Building2} eyebrow="Bill to" title="Customer and invoice details" description="Who is receiving this invoice and when is payment due?">
          <div className={styles.fields}>
            <div className={styles.span2}><div className={styles.actionField}>
              {select('customer_id', 'Customer *', customerChoices, Building2, { placeholder: 'Select active customer', isSearchable: true })}
              <QuickAdd label="Add a new customer" disabled={saving} onClick={() => setCustomerDrawerOpen(true)} />
            </div></div>
            {select('currency', 'Currency *', INVOICE_CURRENCIES, Coins)}
            <DatePicker id="invoice-date" label="Invoice date *" value={form.invoice_date} onChange={(v) => update('invoice_date', v)} error={errors.invoice_date} />
            <DatePicker id="invoice-due-date" label="Due date *" value={form.due_date} onChange={(v) => update('due_date', v)} min={form.invoice_date || undefined} error={errors.due_date} />
            {input('subject', 'Invoice subject', 'Monthly support services', FileText)}
            {input('reference', 'Reference', 'Optional reference', FileText)}
            {input('purchase_order_number', 'Purchase order number', 'Optional PO number', FileText)}
            <div className={styles.span2}><div className={styles.actionField}>
              {select('bank_account_id', 'Payment account', accountChoices, WalletCards, { placeholder: accountChoices.length ? 'Select account shown on invoice' : 'Add an account for this currency', isClearable: true, isDisabled: !accountChoices.length })}
              <QuickAdd label="Add a payment account" disabled={saving} onClick={() => setAccountDrawerOpen(true)} />
            </div></div>
          </div>
        </Panel>
        <Panel icon={Package} eyebrow="Billable lines" title="Products and services" description="Select catalogue items and adjust pricing, quantity, discounts and taxes." aside={<span className={styles.count}>{form.items.length} {form.items.length === 1 ? 'item' : 'items'}</span>}>
          {!eligibleItems.length && <p className={styles.notice}><Info size={15} /> No active products or services match {form.currency}. Add an item using the + button.</p>}
          <div className={styles.lines}>{form.items.map((line, index) => {
            const item = items.find((entry) => String(entry.id) === line.item_id)
            const allowDiscount = Number(item?.discount_allowed) === 1
            const classification = invoiceLineClassification(line, item)
            return <div key={line.key} className={styles.line}>
              <header className={styles.lineHeader}><div><span className={styles.lineNumber}>{String(index + 1).padStart(2, '0')}</span><strong>{item?.name || `Line item ${index + 1}`}</strong></div>
                {form.items.length > 1 && <button className={styles.delete} type="button" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(index)} disabled={saving}><Trash2 size={15} /> Remove</button>}</header>
              {item && item.currency !== form.currency && <p className={styles.notice}><AlertCircle size={15} /> This item is priced in {item.currency}. Choose an item that matches the invoice currency ({form.currency}).</p>}
              <div className={styles.lineGrid}>
                <div className={styles.lineProduct}><div className={styles.actionField}>
                  <Select id={`invoice-item-${line.key}`} size="md" label="Product / service *" icon={Package} value={line.item_id} options={itemChoices} onChange={(v) => updateLine(index, 'item_id', v)} isSearchable placeholder="Select catalogue item" error={errors[`items.${index}.item_id`]} />
                  <QuickAdd label={`Add a new product or service for line ${index + 1}`} disabled={saving} onClick={() => setItemDrawerLine(index)} />
                </div></div>
                <TextField id={`invoice-qty-${line.key}`} size="md" label="Quantity *" inputMode="decimal" value={line.quantity} error={errors[`items.${index}.quantity`]} onChange={(e) => updateLine(index, 'quantity', e.target.value)} autoComplete="off" />
                <TextField id={`invoice-price-${line.key}`} size="md" label={`Unit price (${form.currency}) *`} inputMode="decimal" value={line.unit_price} error={errors[`items.${index}.unit_price`]} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} autoComplete="off" />
                <Select id={`invoice-tax-${line.key}`} size="md" label="Tax treatment *" icon={Percent} value={line.tax_rate_id} options={taxChoices} onChange={(v) => updateLine(index, 'tax_rate_id', v)} error={errors[`items.${index}.tax_rate_id`]} placeholder="Select tax" />
                <Select id={`invoice-discount-type-${line.key}`} size="md" label="Line discount" value={line.discount_type} options={DISCOUNT_TYPES} onChange={(v) => updateLine(index, 'discount_type', v)} isDisabled={!allowDiscount} />
                <TextField id={`invoice-discount-value-${line.key}`} size="md" label={line.discount_type === 'percentage' ? 'Discount %' : 'Discount amount'} inputMode="decimal" value={line.discount_type === 'none' ? '' : line.discount_value} onChange={(e) => updateLine(index, 'discount_value', e.target.value)} error={errors[`items.${index}.discount_value`]} disabled={!allowDiscount || line.discount_type === 'none'} placeholder="0.00" />
                <div className={styles.lineDescription}><Textarea id={`invoice-description-${line.key}`} label="Line description" rows={2} value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} placeholder="Description shown on the invoice" /></div>
              </div>
              <div className={styles.lineMeta}>{item ? <>
                <span>Catalogue base price: <strong>{money(item.default_unit_price, item.currency)}</strong></span>
                <span>Billing unit: <strong>{item.unit_name || 'Unit'}</strong></span>
                <span>{allowDiscount ? 'Discount allowed' : 'Fixed pricing'}</span>
                <div className={styles.lineClassification}>
                  <span>{classification.label}</span>
                  <strong className="ref">{classification.code || 'Not set — update catalogue'}</strong>
                  <small>{classification.code
                    ? 'Local catalogue code; NRS verification pending.'
                    : 'No classification code saved on this item. Update the catalogue for NRS readiness.'}</small>
                  {classification.hasSavedSnapshot && <small>
                    Saved draft snapshot ({classification.savedType === 'goods' ? 'HS' : 'Service'}):{' '}
                    <span className="ref">{classification.savedCode || 'Not set'}</span>
                  </small>}
                  {classification.changedSinceSave && <small className={styles.snapshotChanged} role="status">
                    <Info size={13} aria-hidden="true" /> Catalogue classification differs from the saved draft. Saving will refresh this line's snapshot.
                  </small>}
                  {!classification.hasSavedSnapshot && <small>The backend captures this classification when the draft is saved.</small>}
                </div>
              </> : 'Select a catalogue item to load its saved pricing and discount rule.'}</div>
            </div>
          })}</div>
          <div className={styles.addLine}><Button variant="secondary" icon={CirclePlus} onClick={addLine} disabled={saving}>Add another line item</Button><span>{form.items.length} billable {form.items.length === 1 ? 'line' : 'lines'} on this invoice</span></div>
        </Panel>
        <Panel icon={ShieldCheck} eyebrow="FIRS / MBS readiness" title="Compliance classification" description="Classify the local record now; live NRS/FIRS submission is not yet enabled." aside={<span className={styles.local}><ShieldCheck size={13} /> Local only</span>}>
          <div className={styles.fields}>
            {select('firs_transaction_type', 'Transaction model *', FIRS_TRANSACTION_TYPES, BadgeCheck)}
            {select('firs_document_type', 'Document type *', FIRS_DOCUMENT_TYPES, FileText)}
            {select('firs_invoice_type_code', 'FIRS invoice type *', firsInvoiceTypes.length ? firsInvoiceTypes : FIRS_INVOICE_TYPES, FileText, { isSearchable: true })}
            {select('firs_payment_means_code', 'Payment means *', firsPaymentMeans.length ? firsPaymentMeans : FIRS_PAYMENT_MEANS, WalletCards, { isSearchable: true })}
            <div className={styles.span2}>{select('firs_tax_exemption_code', 'VAT exemption code', exemptionOptions, ShieldCheck, { isSearchable: true, hint: 'Use only when FIRS requires an exemption category for exempt, zero-rated or non-taxable lines.' })}</div>
          </div>
          <p className={styles.notice}><Info size={16} /> {form.firs_transaction_type === 'b2b' ? 'B2B tax invoices should include supplier and buyer TINs, billing address, tax categories, unit codes and item classifications before future FIRS submission.' : 'B2C simplified invoices may use lighter buyer details but still require valid line items, tax treatments, currency and payment means.'}</p>
        </Panel>
        <Panel icon={FileText} eyebrow="Optional details" title="Notes and payment terms" description="Additional information recorded with this invoice.">
          <div className={styles.fields}>
            <Textarea id="invoice-notes" label="Internal / customer notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Add invoice notes" />
            <Textarea id="invoice-terms" label="Terms and conditions" rows={3} value={form.terms_and_conditions} onChange={(e) => update('terms_and_conditions', e.target.value)} placeholder="Terms for this invoice" />
            <Textarea id="invoice-footer" label="Footer note" rows={3} value={form.footer_note} onChange={(e) => update('footer_note', e.target.value)} placeholder="Thank you for your business" />
            <Textarea id="invoice-payment-instructions" label="Payment instructions" rows={3} value={form.payment_instructions} onChange={(e) => update('payment_instructions', e.target.value)} placeholder="How to make payment" />
          </div>
          <div className={styles.payNow}><Switch checked={form.pay_now_enabled} disabled id="invoice-pay-now" label="Pay-Now link" description="Prepared for future NRS/FIRS integration. Disabled until licensed endpoints are enabled." /></div>
        </Panel>
      </main>
      <aside className={styles.sidebar}><div className={styles.summary}>
        <div className={styles.summaryHeader}><span><Calculator size={19} /></span><div><h2>Invoice summary</h2><p>{verifiedTotals ? 'Server-verified totals' : calculating ? 'Verifying with server…' : 'Live working totals'}</p></div></div>
        <div className={styles.summaryBody}>
          <div className={styles.summaryDiscount}>
            {select('discount_type', 'Overall discount', DISCOUNT_TYPES, Percent)}
            {form.discount_type !== 'none' && input('discount_value', form.discount_type === 'percentage' ? 'Discount %' : 'Discount amount', '0.00', Percent, { inputMode: 'decimal' })}
          </div>
          {totals ? <>
            <p className={styles.totalStatus}><CheckCircle2 size={14} /> {verifiedTotals ? 'Totals verified by the server' : 'Live estimate — server verification pending'}</p>
            <dl className={styles.breakdown}>
              <div><dt>Subtotal</dt><dd>{money(totals.subtotal_amount, form.currency)}</dd></div>
              <div><dt>Line discounts</dt><dd>− {money(totals.line_discount_amount, form.currency)}</dd></div>
              <div><dt>Invoice discount</dt><dd>− {money(totals.invoice_discount_amount, form.currency)}</dd></div>
              <div><dt>Taxable amount</dt><dd>{money(totals.net_amount, form.currency)}</dd></div>
              <div><dt>VAT / taxes</dt><dd>{money(totals.tax_amount, form.currency)}</dd></div>
            </dl>
            <div className={styles.grandTotal}><span>Total due</span><strong>{money(totals.total_amount, form.currency)}</strong></div>
          </> : <p className={styles.summaryEmpty}>Complete a billable line to see subtotal, taxes and total due.</p>}
          {calcError && <p className={styles.calcWarning} role="status"><AlertCircle size={15} /> Server verification pending: {calcError}</p>}
          {totals && form.items.length > linesComplete.length && <p className={styles.notice}><Info size={15} /> Preview includes {linesComplete.length} complete {linesComplete.length === 1 ? 'line' : 'lines'}. Complete or remove the remaining lines before saving.</p>}
          <Button icon={Save} block loading={saving} disabled={!ready} onClick={saveDraft}>{editing ? 'Save draft changes' : 'Save as draft'}</Button>
          <p className={styles.summaryFoot}><ShieldCheck size={15} /> Submit for approval after the draft is saved.</p>
        </div>
      </div></aside>
    </div>
    <CustomerFormDrawer open={customerDrawerOpen} defaultCurrency={form.currency} onClose={() => setCustomerDrawerOpen(false)} onSaved={customerSaved} />
    <ItemFormDrawer open={itemDrawerLine !== null} defaultCurrency={form.currency} onClose={() => setItemDrawerLine(null)} onSaved={itemSaved} />
    <InvoicePaymentAccountDrawer open={accountDrawerOpen} currency={form.currency} onClose={() => setAccountDrawerOpen(false)} onSaved={accountSaved} />
  </div>
}
