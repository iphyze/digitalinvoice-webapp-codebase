import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, FileText, Info, MapPin, PackageCheck, Save, Send, Truck } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Select from '../../components/forms/Select'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import DatePicker from '../../components/forms/DatePicker'
import Checkbox from '../../components/forms/Checkbox'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import deliveryNoteService from '../../services/deliveryNoteService'
import invoiceService from '../../services/invoiceService'
import useToastStore from '../../stores/useToastStore'
import { formatCurrency } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { readInvoiceCollection } from '../../utils/apiPayload'
import {
  initialDelivery, fromDelivery, mergeDeliveryLines, deliveryPayload, deliveryRecord, deliverySavedId,
  deliverySource, deliveryEditable, selectedDeliveryLines, validateDelivery,
} from './deliveryNoteModel'
import base from '../invoices/InvoiceEditor.module.css'
import styles from './DeliveryNotes.module.css'

const money = (amount, currency) => { try { return formatCurrency(amount, currency || 'NGN') } catch { return `${currency || 'NGN'} ${Number(amount || 0).toLocaleString('en-NG')}` } }
const invoiceOption = (invoice) => ({ value: String(invoice.id),
  label: `${invoice.invoice_number || `Invoice #${invoice.id}`} · ${invoice.customer_name_snapshot || 'Customer'} · ${money(invoice.total_amount, invoice.currency)}` })

function Panel({ icon: Icon, eyebrow, title, description, children, aside }) {
  return <section className={base.panel}>
    <header className={base.panelHeader}><span className={base.panelIcon}><Icon size={18} aria-hidden="true" /></span>
      <div className={base.panelHeading}><span className={base.eyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</header>
    <div className={base.panelBody}>{children}</div>
  </section>
}

export default function DeliveryNoteEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToastStore((state) => state.showToast)
  const [form, setForm] = useState(initialDelivery)
  const [record, setRecord] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [sourceReload, setSourceReload] = useState(0)
  const [invoiceSearchError, setInvoiceSearchError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const preselected = params.get('invoice') || params.get('invoice_id') || ''

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    const work = editing ? deliveryNoteService.show(id) : Promise.resolve(null)
    work.then((response) => {
      if (!active) return
      if (editing) {
        const note = deliveryRecord(response)
        if (!note || !deliveryEditable(note)) throw new Error('Only draft delivery notes can be edited.')
        setRecord(note)
        setForm(fromDelivery(note))
        setSelectedInvoice({ value: String(note.invoice_id), label: `${note.invoice_number || `Invoice #${note.invoice_id}`} · ${note.customer_name_snapshot || 'Customer'}` })
      } else {
        const selectedId = Number(preselected)
        const fresh = initialDelivery()
        setForm({ ...fresh, invoice_id: Number.isSafeInteger(selectedId) && selectedId > 0 ? String(selectedId) : '' })
        setRecord(null)
        setSelectedInvoice(null)
      }
      setErrors({})
    }).catch((requestError) => { if (active) setLoadError(getErrorMessage(requestError, 'Unable to prepare the delivery note editor.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, id, preselected, reload])

  useEffect(() => {
    const invoiceId = form.invoice_id
    if (!invoiceId || loading || loadError) { setSource(null); setSourceError(''); setSourceLoading(false); return undefined }
    let active = true
    setSource(null)
    setSourceError('')
    setSourceLoading(true)
    deliveryNoteService.sourceInvoice(invoiceId).then((response) => {
      if (!active) return
      const data = deliverySource(response)
      if (!data.invoice || !Array.isArray(data.deliverable_items)) throw new Error('Source invoice lines were not returned.')
      setSource(data)
      setSelectedInvoice(invoiceOption(data.invoice))
      setForm((previous) => previous.invoice_id === invoiceId ? {
        ...previous,
        delivery_address: !editing && !previous.delivery_address ? (data.invoice.customer_address_snapshot || '') : previous.delivery_address,
        items: mergeDeliveryLines(data.deliverable_items, previous.items),
      } : previous)
    }).catch((requestError) => { if (active) setSourceError(getErrorMessage(requestError, 'Unable to load remaining delivery quantities.')) })
      .finally(() => { if (active) setSourceLoading(false) })
    return () => { active = false }
  }, [form.invoice_id, loading, loadError, sourceReload])

  const searchApproved = useCallback(async (text) => {
    try {
      const response = await invoiceService.list({ status: 'approved', search: text.trim() || undefined, page: 1, limit: 50 })
      setInvoiceSearchError('')
      return readInvoiceCollection(response).invoices.map(invoiceOption)
    } catch (requestError) {
      setInvoiceSearchError(getErrorMessage(requestError, 'Unable to search approved invoices.'))
      return []
    }
  }, [])
  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }
  const selectInvoice = (option) => {
    const invoiceId = option?.value || ''
    setSelectedInvoice(option || null)
    setForm((previous) => ({ ...previous, invoice_id: invoiceId, items: [], delivery_address: '' }))
    setErrors({})
  }
  const updateLine = (lineId, change) => {
    setForm((previous) => ({ ...previous, items: previous.items.map((line) =>
      String(line.invoice_item_id) === String(lineId) ? { ...line, ...change } : line) }))
    setErrors((previous) => ({ ...previous, items: undefined, [`quantity.${lineId}`]: undefined }))
  }
  const available = source?.deliverable_items || []
  const currentInvoice = source?.invoice
  const choices = useMemo(() => new Map(form.items.map((line) => [String(line.invoice_item_id), line])), [form.items])
  const chosen = selectedDeliveryLines(form)

  const save = async (action) => {
    if (saving || loading || sourceLoading || sourceError) return
    const nextErrors = validateDelivery(form, source)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast('Review the highlighted delivery details before continuing.', 'warning', 'Delivery note incomplete')
      setIssueOpen(false)
      return
    }
    setSaving(true)
    try {
      const response = editing ? await deliveryNoteService.update(deliveryPayload(form, action, id))
        : await deliveryNoteService.create(deliveryPayload(form, action))
      const savedId = deliverySavedId(response)
      if (!savedId) throw new Error('The server did not confirm the saved delivery note. Check the list before retrying.')
      toast(response.data?.message || (action === 'issue' ? 'Delivery note issued successfully.' : 'Delivery note draft saved successfully.'),
        'success', action === 'issue' ? 'Issued' : 'Draft saved')
      navigate(`/app/delivery-notes/${savedId}`, { replace: true })
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to save delivery note.'), 'error', 'Save failed') }
    finally { setSaving(false); setIssueOpen(false) }
  }
  const requestIssue = () => {
    const next = validateDelivery(form, source)
    setErrors(next)
    if (Object.keys(next).length) toast('Review the highlighted delivery details before issuing.', 'warning', 'Delivery note incomplete')
    else setIssueOpen(true)
  }

  if (loading) return <div className={base.page} aria-busy="true"><div className={base.skeleton} /><div className={base.skeleton} /></div>
  if (loadError) return <div className={base.errorState} role="alert"><AlertCircle size={27} />
    <h2>Delivery note form unavailable</h2><p>{loadError}</p><div className={base.errorActions}>
      <Button onClick={() => setReload((value) => value + 1)}>Try again</Button><Button variant="secondary" to="/app/delivery-notes">Back to delivery notes</Button></div></div>

  return <div className={`${base.page} fx-enter`}>
    <div className={base.breadcrumb}><Link to="/app/delivery-notes"><ArrowLeft size={14} /> Delivery Notes</Link><span>/</span><span>{editing ? 'Edit draft' : 'New delivery note'}</span></div>
    <PageHeader eyebrow="Sales documents" title={editing ? 'Edit delivery note draft' : 'Create delivery note'}
      description="Confirm what is being delivered against an approved invoice. Delivery notes are not NRS tax invoices."
      actions={<div className={base.headerActions}><Button variant="secondary" to="/app/delivery-notes">Cancel</Button>
        <Button variant="secondary" icon={Save} loading={saving} disabled={sourceLoading} onClick={() => save('draft')}>Save draft</Button>
        <Button icon={Send} loading={saving} disabled={sourceLoading || Boolean(sourceError)} onClick={requestIssue}>Issue delivery note</Button></div>} />
    <div className={base.layout}>
      <main className={base.main}>
        <Panel icon={FileText} eyebrow="Source document" title="Approved invoice" description="Search the source invoice to load its remaining deliverable quantities.">
          <Select id="delivery-invoice" label="Source invoice *" size="md" loadOptions={searchApproved} isSearchable
            value={selectedInvoice} onChange={selectInvoice} isDisabled={editing || saving}
            placeholder="Search approved invoices" error={errors.invoice_id} />
          {invoiceSearchError && <p className={styles.error} role="alert">{invoiceSearchError}</p>}
          {sourceLoading && <p className={styles.subtle}>Checking outstanding delivery quantities…</p>}
          {sourceError && <div className={styles.errorPanel} role="alert"><p>{sourceError}</p><Button variant="secondary" size="sm" onClick={() => setSourceReload((v) => v + 1)}>Retry source invoice</Button></div>}
          {currentInvoice && <div className={styles.sourceContext}>
            <div><small>Customer</small><strong>{currentInvoice.customer_name_snapshot || '—'}</strong></div>
            <div><small>Invoice</small><strong className="num ref">{currentInvoice.invoice_number || `Invoice #${currentInvoice.id}`}</strong></div>
            <div><small>Invoice date</small><strong className="num">{currentInvoice.invoice_date}</strong></div>
          </div>}
        </Panel>
        <Panel icon={CalendarDays} eyebrow="Delivery instructions" title="Date and destination" description="These details appear on the issued customer document.">
          <div className={base.fields}>
            <DatePicker id="delivery-date" label="Delivery date *" value={form.delivery_date}
              min={currentInvoice?.invoice_date || undefined} onChange={(value) => update('delivery_date', value)} error={errors.delivery_date} />
            <TextField id="delivery-reference" label="Reference" size="md" maxLength={100} value={form.reference}
              onChange={(event) => update('reference', event.target.value)} placeholder="Dispatch or delivery reference" error={errors.reference} />
            <div className={base.span2}><Textarea id="delivery-address" label="Delivery address" rows={3} maxLength={1000}
              value={form.delivery_address} onChange={(event) => update('delivery_address', event.target.value)} error={errors.delivery_address} /></div>
            <div className={base.span2}><Textarea id="delivery-notes" label="Notes" rows={3} maxLength={2000}
              value={form.notes} onChange={(event) => update('notes', event.target.value)} error={errors.notes} /></div>
          </div>
        </Panel>
        <Panel icon={PackageCheck} eyebrow="Dispatch quantities" title="Invoice lines to deliver"
          description="Choose the invoice lines and enter quantities to dispatch. Previously issued deliveries reduce the available quantity."
          aside={<span className={base.count}>{chosen.length} selected</span>}>
          {!currentInvoice && <p className={styles.subtle}>Choose an approved invoice to see its lines.</p>}
          {currentInvoice && !available.length && <p className={styles.subtle}>This source invoice has no deliverable lines.</p>}
          <div className={styles.deliveryLines}>{available.map((line, index) => {
            const selected = choices.get(String(line.invoice_item_id)) || { selected: false, delivered_quantity: '' }
            const remaining = Number(line.remaining_quantity || 0)
            return <div className={styles.deliveryLine} key={line.invoice_item_id} data-selected={selected.selected || undefined}>
              <div className={styles.lineHeading}>
                <span className={base.lineNumber}>{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{line.item_name_snapshot || `Invoice line ${index + 1}`}</strong>
                  <small>{line.item_description_snapshot || line.item_code_snapshot || 'Invoice item'}</small></div>
              </div>
              <div className={styles.quantityMeta}><span>Invoiced: <strong className="num">{line.invoice_quantity} {line.unit_code_snapshot || ''}</strong></span>
                <span>Already delivered: <strong className="num">{line.already_delivered_quantity}</strong></span>
                <span>Remaining: <strong className="num">{line.remaining_quantity}</strong></span></div>
              <div className={styles.quantityControls}>
                <Checkbox id={`delivery-select-${line.invoice_item_id}`} label="Include in this delivery" checked={selected.selected}
                  disabled={saving || remaining <= 0} onChange={(event) => updateLine(line.invoice_item_id, {
                    selected: event.target.checked,
                    delivered_quantity: event.target.checked ? (selected.delivered_quantity || String(line.remaining_quantity)) : '',
                  })} />
                <TextField id={`delivery-quantity-${line.invoice_item_id}`} size="md" label="Quantity to deliver" inputMode="decimal"
                  value={selected.delivered_quantity} disabled={!selected.selected || saving || remaining <= 0}
                  onChange={(event) => updateLine(line.invoice_item_id, { delivered_quantity: event.target.value })}
                  error={errors[`quantity.${line.invoice_item_id}`]} />
              </div>
            </div>
          })}</div>
          {errors.items && <p className={styles.error} role="alert">{errors.items}</p>}
        </Panel>
      </main>
      <aside className={base.sidebar}><div className={base.summary}>
        <div className={base.summaryHeader}><span><Truck size={19} /></span><div><h2>Delivery summary</h2><p>Quantity-only record; no tax or payment is raised</p></div></div>
        <div className={base.summaryBody}>
          <div className={styles.summaryNumber}><span>Selected invoice lines</span><strong className="num">{chosen.length}</strong></div>
          <div className={styles.summaryNumber}><span>Source invoice lines</span><strong className="num">{available.length}</strong></div>
          <div className={styles.summaryNumber}><span>Delivery date</span><strong className="num">{form.delivery_date || '—'}</strong></div>
          <p className={styles.subtle}><Info size={15} /> The server validates remaining quantities again when you save or issue.</p>
          <Button variant="secondary" icon={Save} loading={saving} disabled={sourceLoading} onClick={() => save('draft')}>Save draft</Button>
          <Button icon={ClipboardCheck} loading={saving} disabled={sourceLoading || Boolean(sourceError)} onClick={requestIssue}>Issue delivery note</Button>
        </div>
      </div></aside>
    </div>
    <ConfirmDialog open={issueOpen} title="Issue this delivery note?" variant="primary" confirmLabel="Issue delivery note"
      message="Issuing assigns the delivery note number and locks this document against further editing. Check the quantities before continuing."
      loading={saving} onConfirm={() => save('issue')} onClose={() => !saving && setIssueOpen(false)} />
  </div>
}
