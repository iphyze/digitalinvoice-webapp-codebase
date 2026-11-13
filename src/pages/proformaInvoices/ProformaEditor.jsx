import { addDays, format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Building2, Calculator, CirclePlus, Coins, FileSignature,
  FileText, Info, Package, Percent, Plus, Save, Send, Trash2, WalletCards,
} from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import CustomerFormDrawer from '../customers/CustomerFormDrawer'
import ItemFormDrawer from '../catalogue/ItemFormDrawer'
import InvoicePaymentAccountDrawer from '../invoices/InvoicePaymentAccountDrawer'
import customerService from '../../services/customerService'
import itemService from '../../services/itemService'
import referenceService from '../../services/referenceService'
import onboardingService from '../../services/onboardingService'
import proformaInvoiceService from '../../services/proformaInvoiceService'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { formatCurrency } from '../../utils/formatters'
import { calculateInvoicePreview, getCompletedInvoiceLines } from '../../utils/invoiceCalculationPreview'
import { DISCOUNT_TYPES, INVOICE_CURRENCIES } from '../invoices/invoiceEditorOptions'
import {
  blankProformaLine, fromProforma, initialProforma, proformaPayload, savedProformaId, validateProforma,
} from './proformaModel'
import styles from '../invoices/InvoiceEditor.module.css'
import extra from './Proforma.module.css'

const money = (value, currency) => {
  try { return formatCurrency(value, currency || 'NGN') }
  catch { return `${currency || 'NGN'} ${Number(value || 0).toLocaleString('en-NG')}` }
}
const options = (records, label) => records.map((row) => ({ value: String(row.id), label: label(row) }))
const insert = (records, saved) => saved?.id ? [saved, ...records.filter((row) => String(row.id) !== String(saved.id))] : records

function Panel({ icon: Icon, eyebrow, title, description, children, aside }) {
  return <section className={styles.panel}>
    <header className={styles.panelHeader}>
      <span className={styles.panelIcon}><Icon size={18} aria-hidden="true" /></span>
      <div className={styles.panelHeading}><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      {aside}
    </header>
    <div className={styles.panelBody}>{children}</div>
  </section>
}
function QuickAdd({ label, onClick, disabled }) {
  return <button type="button" className={styles.quickAdd} title={label} aria-label={label} onClick={onClick} disabled={disabled}>
    <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
  </button>
}

export default function ProformaEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToastStore((state) => state.showToast)
  const [form, setForm] = useState(initialProforma)
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [customerDrawer, setCustomerDrawer] = useState(false)
  const [itemDrawerLine, setItemDrawerLine] = useState(null)
  const [accountDrawer, setAccountDrawer] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    Promise.all([
      customerService.list({ status: 'active', limit: 100 }),
      itemService.list({ status: 'active', limit: 100 }),
      referenceService.taxRates(),
      onboardingService.getBankAccounts(),
      onboardingService.getInvoiceSettings(),
      editing ? proformaInvoiceService.show(id) : Promise.resolve(null),
    ]).then(([customerResponse, itemResponse, rateResponse, accountResponse, settingsResponse, detailResponse]) => {
      if (!active) return
      const nextCustomers = customerResponse.data?.data?.customers || []
      const nextItems = itemResponse.data?.data?.items || []
      setCustomers(nextCustomers)
      setItems(nextItems)
      setTaxRates(rateResponse.data?.data?.tax_rates || [])
      setAccounts(accountResponse.data?.data?.bank_accounts || [])
      if (editing) {
        const record = detailResponse?.data?.data?.proforma
        if (!record || record.status !== 'draft') throw new Error('Only draft proforma invoices can be edited.')
        setForm(fromProforma(record))
      } else {
        const settings = settingsResponse.data?.data?.settings || {}
        const selectedItem = nextItems.find((item) => String(item.id) === String(searchParams.get('item')))
        const today = new Date()
        setForm({
          ...initialProforma(),
          customer_id: nextCustomers.some((customer) => String(customer.id) === String(searchParams.get('customer'))) ? String(searchParams.get('customer')) : '',
          expiry_date: format(addDays(today, 30), 'yyyy-MM-dd'),
          currency: selectedItem?.currency || settings.default_currency || 'NGN',
          footer_note: 'This proforma is valid until the expiry date shown above.',
          payment_instructions: settings.payment_instructions || '',
          items: selectedItem ? [{ ...blankProformaLine(), item_id: String(selectedItem.id), description: selectedItem.description || '',
            unit_price: String(selectedItem.default_unit_price ?? ''), tax_rate_id: String(selectedItem.tax_rate_id || '') }] : [blankProformaLine()],
        })
      }
      setErrors({})
    }).catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Unable to load the proforma form.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, id, reload, searchParams])

  const eligibleItems = useMemo(() => items.filter((item) => item.currency === form.currency), [items, form.currency])
  const customerChoices = useMemo(() => options(customers, (c) => `${c.name} — ${c.customer_code || 'Customer'}`), [customers])
  const itemChoices = useMemo(() => options(eligibleItems, (i) => `${i.name} — ${money(i.default_unit_price, i.currency)}`), [eligibleItems])
  const taxChoices = useMemo(() => options(taxRates, (t) => `${t.name} — ${Number(t.rate_percent || 0).toFixed(2)}%`), [taxRates])
  const accountChoices = useMemo(() => options(accounts.filter((a) => Number(a.is_active) && a.currency === form.currency),
    (a) => `${a.bank_name} — ${a.account_number} (${a.currency})`), [accounts, form.currency])
  const completeLines = useMemo(() => getCompletedInvoiceLines(form.items).filter((line) => eligibleItems.some((item) => String(item.id) === String(line.item_id))), [form.items, eligibleItems])
  const preview = useMemo(() => calculateInvoicePreview({ lines: completeLines, taxRates, discountType: form.discount_type, discountValue: form.discount_value }),
    [completeLines, taxRates, form.discount_type, form.discount_value])
  const totals = preview?.totals

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value, ...(key === 'currency' ? { bank_account_id: '' } : {}),
      ...(key === 'discount_type' && value === 'none' ? { discount_value: '0' } : {}) }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }
  const updateLine = (index, key, value, savedItem = null) => {
    setForm((previous) => ({ ...previous, items: previous.items.map((row, i) => {
      if (i !== index) return row
      const line = { ...row, [key]: value }
      if (key === 'item_id') {
        const item = savedItem || items.find((entry) => String(entry.id) === String(value))
        line.description = item?.description || ''
        line.unit_price = String(item?.default_unit_price ?? '')
        line.tax_rate_id = String(item?.tax_rate_id || '')
        if (!Number(item?.discount_allowed)) { line.discount_type = 'none'; line.discount_value = '0' }
      }
      if (key === 'discount_type' && value === 'none') line.discount_value = '0'
      return line
    }) }))
    setErrors((previous) => ({ ...previous, [`items.${index}.${key}`]: undefined }))
  }
  const removeLine = (index) => {
    if (form.items.length === 1) return
    setForm((previous) => ({ ...previous, items: previous.items.filter((_, i) => i !== index) }))
    setErrors({})
  }
  const validate = () => {
    const next = validateProforma(form, items, taxRates, accounts)
    setErrors(next)
    if (Object.keys(next).length) {
      toast('Review the highlighted fields before saving.', 'warning', 'Required details missing')
      return false
    }
    return true
  }
  const save = async (action) => {
    if (saving || loading || !validate()) return
    setSaving(true)
    try {
      const payload = proformaPayload(form, action, editing ? id : undefined)
      const response = editing ? await proformaInvoiceService.update(payload) : await proformaInvoiceService.create(payload)
      const savedId = savedProformaId(response)
      if (!savedId) throw new Error('The server did not confirm a saved proforma. Check the register before trying again.')
      toast(action === 'issue' ? 'Proforma invoice issued successfully.' : editing ? 'Proforma draft updated.' : 'Proforma draft saved.', 'success', action === 'issue' ? 'Issued' : 'Draft saved')
      navigate(`/app/proforma-invoices/${savedId}`, { replace: true })
    } catch (error) {
      toast(getErrorMessage(error, 'Unable to save proforma invoice.'), 'error', 'Proforma not saved')
    } finally { setSaving(false); setIssueOpen(false) }
  }
  const issue = () => { if (validate()) setIssueOpen(true) }

  if (loading) return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /><div className={styles.skeleton} /></div>
  if (loadError) return <div className={styles.errorState} role="alert"><AlertCircle size={26} /><h2>Proforma form unavailable</h2><p>{loadError}</p>
    <div className={styles.errorActions}><Button onClick={() => setReload((value) => value + 1)}>Try again</Button><Button variant="secondary" to="/app/proforma-invoices">Back to proformas</Button></div></div>

  const text = (key, label, placeholder, icon, more = {}) => <TextField id={`proforma-${key}`} size="md" label={label} placeholder={placeholder} icon={icon}
    value={form[key]} onChange={(e) => update(key, e.target.value)} error={errors[key]} autoComplete="off" {...more} />
  const select = (key, label, available, icon, more = {}) => <Select id={`proforma-${key}`} size="md" label={label} icon={icon} options={available}
    value={form[key]} onChange={(value) => update(key, value)} error={errors[key]} {...more} />
  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.breadcrumb}><Link to="/app/proforma-invoices"><ArrowLeft size={14} /> Proforma Invoices</Link><span>/</span><span>{editing ? 'Edit draft' : 'New proforma'}</span></div>
    <PageHeader eyebrow="Sales documents" title={editing ? 'Edit proforma draft' : 'Create proforma invoice'}
      description="Prepare a quotation-style proforma for your customer. This is not an NRS tax invoice."
      actions={<div className={styles.headerActions}><Button variant="secondary" to="/app/proforma-invoices">Cancel</Button>
        <Button variant="secondary" icon={Save} loading={saving} onClick={() => save('draft')}>Save draft</Button>
        <Button icon={Send} loading={saving} onClick={issue}>Issue proforma</Button></div>} />
    <div className={styles.layout}>
      <main className={styles.main}>
        <Panel icon={Building2} eyebrow="Prepared for" title="Customer and document details" description="Set the recipient, validity period and payment details.">
          <div className={styles.fields}>
            <div className={styles.span2}><div className={styles.actionField}>
              {select('customer_id', 'Customer *', customerChoices, Building2, { isSearchable: true, placeholder: 'Select active customer' })}
              <QuickAdd label="Add customer" disabled={saving} onClick={() => setCustomerDrawer(true)} />
            </div></div>
            {select('currency', 'Currency *', INVOICE_CURRENCIES, Coins)}
            <DatePicker id="proforma-issue-date" label="Issue date *" value={form.issue_date} onChange={(v) => update('issue_date', v)} error={errors.issue_date} />
            <DatePicker id="proforma-expiry-date" label="Expiry date *" min={form.issue_date || undefined} value={form.expiry_date} onChange={(v) => update('expiry_date', v)} error={errors.expiry_date} />
            {text('subject', 'Subject', 'Equipment supply proposal', FileSignature, { maxLength: 180 })}
            {text('reference', 'Reference', 'Optional reference', FileText, { maxLength: 100 })}
            <div className={styles.span2}><div className={styles.actionField}>
              {select('bank_account_id', 'Payment account', accountChoices, WalletCards, { isClearable: true, isDisabled: !accountChoices.length,
                placeholder: 'Select payment account for this currency' })}
              <QuickAdd label="Add payment account" disabled={saving} onClick={() => setAccountDrawer(true)} />
            </div></div>
          </div>
        </Panel>
        <Panel icon={Package} eyebrow="Proposed charges" title="Products and services" description="Prices, tax and discounts remain estimates until a tax invoice is prepared."
          aside={<span className={styles.count}>{form.items.length} line{form.items.length === 1 ? '' : 's'}</span>}>
          {!eligibleItems.length && <p className={styles.notice}><Info size={15} /> No active catalogue items match {form.currency}. Add one to continue.</p>}
          <div className={styles.lines}>{form.items.map((line, index) => {
            const item = items.find((row) => String(row.id) === String(line.item_id))
            const discountAllowed = Number(item?.discount_allowed) === 1
            return <div className={styles.line} key={line.key}>
              <header className={styles.lineHeader}><div><span className={styles.lineNumber}>{String(index + 1).padStart(2, '0')}</span><strong>{item?.name || `Line item ${index + 1}`}</strong></div>
                {form.items.length > 1 && <button type="button" className={styles.delete} onClick={() => removeLine(index)} disabled={saving}><Trash2 size={15} /> Remove</button>}</header>
              <div className={styles.lineGrid}>
                <div className={styles.lineProduct}><div className={styles.actionField}>
                  <Select id={`proforma-item-${line.key}`} label="Product / service *" size="md" icon={Package} value={line.item_id} onChange={(v) => updateLine(index, 'item_id', v)}
                    options={itemChoices} isSearchable error={errors[`items.${index}.item_id`]} />
                  <QuickAdd label={`Add a catalogue item to line ${index + 1}`} disabled={saving} onClick={() => setItemDrawerLine(index)} />
                </div></div>
                <TextField id={`proforma-quantity-${line.key}`} label="Quantity *" size="md" inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} error={errors[`items.${index}.quantity`]} />
                <TextField id={`proforma-price-${line.key}`} label={`Unit price (${form.currency}) *`} size="md" inputMode="decimal" value={line.unit_price} onChange={(e) => updateLine(index, 'unit_price', e.target.value)} error={errors[`items.${index}.unit_price`]} />
                <Select id={`proforma-tax-${line.key}`} label="Tax treatment *" size="md" icon={Percent} value={line.tax_rate_id} options={taxChoices} onChange={(v) => updateLine(index, 'tax_rate_id', v)} error={errors[`items.${index}.tax_rate_id`]} />
                <Select id={`proforma-line-discount-${line.key}`} label="Line discount" size="md" value={line.discount_type} options={DISCOUNT_TYPES} isDisabled={!discountAllowed} onChange={(v) => updateLine(index, 'discount_type', v)} />
                <TextField id={`proforma-discount-${line.key}`} size="md" label={line.discount_type === 'percentage' ? 'Discount %' : 'Discount amount'} inputMode="decimal"
                  value={line.discount_type === 'none' ? '' : line.discount_value} disabled={!discountAllowed || line.discount_type === 'none'} onChange={(e) => updateLine(index, 'discount_value', e.target.value)} error={errors[`items.${index}.discount_value`]} />
                <div className={styles.lineDescription}><Textarea id={`proforma-description-${line.key}`} label="Line description" rows={2} maxLength={2000}
                  value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} error={errors[`items.${index}.description`]} /></div>
              </div>
              <div className={styles.lineMeta}>{item ? <>Catalogue base price: <strong>{money(item.default_unit_price, item.currency)}</strong> · {item.unit_name || 'Unit'}</> : 'Select a catalogue item to load pricing and tax defaults.'}</div>
            </div>
          })}</div>
          {errors.items && <p className={extra.error} role="alert">{errors.items}</p>}
          <div className={styles.addLine}><Button variant="secondary" icon={CirclePlus} disabled={saving} onClick={() => setForm((previous) => ({ ...previous, items: [...previous.items, blankProformaLine()] }))}>Add another line item</Button></div>
        </Panel>
        <Panel icon={FileText} eyebrow="Optional details" title="Notes and terms" description="These details are printed on the proforma document.">
          <div className={styles.fields}>
            <Textarea label="Notes" id="proforma-notes" value={form.notes} rows={3} maxLength={5000} error={errors.notes} onChange={(e) => update('notes', e.target.value)} />
            <Textarea label="Terms and conditions" id="proforma-terms" value={form.terms_and_conditions} rows={3} maxLength={5000} error={errors.terms_and_conditions} onChange={(e) => update('terms_and_conditions', e.target.value)} />
            <Textarea label="Footer note" id="proforma-footer" value={form.footer_note} rows={3} maxLength={2000} error={errors.footer_note} onChange={(e) => update('footer_note', e.target.value)} />
            <Textarea label="Payment instructions" id="proforma-payment" value={form.payment_instructions} rows={3} maxLength={3000} error={errors.payment_instructions} onChange={(e) => update('payment_instructions', e.target.value)} />
          </div>
        </Panel>
      </main>
      <aside className={styles.sidebar}><div className={styles.summary}>
        <div className={styles.summaryHeader}><span><Calculator size={19} /></span><div><h2>Proforma summary</h2><p>Local estimate; server calculates final amounts</p></div></div>
        <div className={styles.summaryBody}>
          <div className={styles.summaryDiscount}>
            {select('discount_type', 'Overall discount', DISCOUNT_TYPES, Percent)}
            {form.discount_type !== 'none' && text('discount_value', form.discount_type === 'percentage' ? 'Discount %' : 'Discount amount', '0.00', Percent, { inputMode: 'decimal' })}
          </div>
          {totals ? <><dl className={styles.breakdown}>
            <div><dt>Subtotal</dt><dd className="num">{money(totals.subtotal_amount, form.currency)}</dd></div>
            <div><dt>Line discounts</dt><dd className="num">− {money(totals.line_discount_amount, form.currency)}</dd></div>
            <div><dt>Overall discount</dt><dd className="num">− {money(totals.invoice_discount_amount, form.currency)}</dd></div>
            <div><dt>Tax</dt><dd className="num">{money(totals.tax_amount, form.currency)}</dd></div>
          </dl><div className={styles.grandTotal}><span>Estimated total</span><strong className="num">{money(totals.total_amount, form.currency)}</strong></div></>
            : <p className={styles.summaryEmpty}>Complete a line item to preview the proforma total.</p>}
          {completeLines.length !== form.items.length && <p className={styles.notice}><Info size={15} /> Incomplete lines are excluded from the estimate.</p>}
          <Button block variant="secondary" icon={Save} loading={saving} onClick={() => save('draft')}>Save as draft</Button>
          <Button block icon={Send} loading={saving} onClick={issue}>Issue proforma</Button>
          <p className={styles.summaryFoot}><Info size={15} /> A proforma is not a tax invoice or NRS submission. Issuing locks further edits.</p>
        </div>
      </div></aside>
    </div>
    <CustomerFormDrawer open={customerDrawer} defaultCurrency={form.currency} onClose={() => setCustomerDrawer(false)} onSaved={(customer) => {
      setCustomers((previous) => insert(previous, customer)); update('customer_id', String(customer.id)); setCustomerDrawer(false)
    }} />
    <ItemFormDrawer open={itemDrawerLine !== null} defaultCurrency={form.currency} onClose={() => setItemDrawerLine(null)} onSaved={(item) => {
      setItems((previous) => insert(previous, item))
      if (item.currency === form.currency && itemDrawerLine !== null) updateLine(itemDrawerLine, 'item_id', String(item.id), item)
      else toast(`Item added in ${item.currency}. Select it when using that currency.`, 'info', 'Catalogue updated')
      setItemDrawerLine(null)
    }} />
    <InvoicePaymentAccountDrawer open={accountDrawer} currency={form.currency} onClose={() => setAccountDrawer(false)} onSaved={(list, account) => {
      setAccounts(list)
      if (account?.id && account.currency === form.currency) update('bank_account_id', String(account.id))
      setAccountDrawer(false)
    }} />
    <ConfirmDialog open={issueOpen} title="Issue this proforma invoice?" message="The backend will assign a proforma number and lock the document against further editing. This is not an NRS tax invoice."
      confirmLabel="Issue proforma" loading={saving} onClose={() => !saving && setIssueOpen(false)} onConfirm={() => save('issue')} />
  </div>
}
