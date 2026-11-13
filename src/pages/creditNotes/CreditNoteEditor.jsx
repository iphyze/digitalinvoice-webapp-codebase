import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Calculator, CheckCircle2, FileMinus2, FileText, Hash, Info, ReceiptText, Save, Send, ShieldCheck } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Select from '../../components/forms/Select'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import DatePicker from '../../components/forms/DatePicker'
import Checkbox from '../../components/forms/Checkbox'
import creditNoteService from '../../services/creditNoteService'
import invoiceService from '../../services/invoiceService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatCurrency } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { creditNoteReferenceLabel } from '../../components/documents/labels'
import { readInvoiceCollection } from '../../utils/apiPayload'
import {
  blankCreditNote, fromCreditNote, mergeCreditLines, creditNotePayload, creditNoteRecord,
  creditNoteSavedId, estimateCredit, validateCreditNoteForm, CREDIT_NOTE_REASON_CATEGORIES,
} from './creditNoteEditorModel'
import base from '../invoices/InvoiceEditor.module.css'
import styles from './CreditNoteEditor.module.css'

const money = (value, unit) => { try { return formatCurrency(value, unit || 'NGN') } catch { return `${unit || 'NGN'} ${Number(value || 0).toLocaleString('en-NG')}` } }
const invoiceChoice = (invoice) => ({
  value: String(invoice.id),
  label: `${invoice.invoice_number || `Invoice #${invoice.id}`} · ${invoice.customer_name_snapshot || 'Customer'} · ${money(invoice.total_amount, invoice.currency)}`,
})

function Panel({ icon: Icon, eyebrow, title, description, children, aside }) {
  return <section className={base.panel}>
    <header className={base.panelHeader}><span className={base.panelIcon}><Icon size={18} aria-hidden="true" /></span>
      <div className={base.panelHeading}><span className={base.eyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</header>
    <div className={base.panelBody}>{children}</div>
  </section>
}

export default function CreditNoteEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToastStore((state) => state.showToast)
  const permissions = useAuthStore((state) => state.permissions)
  const canSubmit = hasPermission(permissions, 'credit_notes.edit')
  const [form, setForm] = useState(blankCreditNote)
  const [note, setNote] = useState(null)
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
  const preselectedId = params.get('invoice') || params.get('invoice_id')

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    const work = editing ? creditNoteService.show(id) : Promise.resolve(null)
    work.then((response) => {
      if (!active) return
      if (editing) {
        const record = creditNoteRecord(response)
        if (!record || !['draft', 'rejected'].includes(record.status)) throw new Error('Only draft or returned credit notes can be edited.')
        setNote(record)
        setForm(fromCreditNote(record))
        setSelectedInvoice(invoiceChoice({ id: record.invoice_id, invoice_number: record.invoice_number,
          customer_name_snapshot: record.customer_name_snapshot, total_amount: record.invoice_total_amount, currency: record.currency }))
      } else {
        const invoiceId = Number(preselectedId)
        setForm({ ...blankCreditNote(), invoice_id: Number.isSafeInteger(invoiceId) && invoiceId > 0 ? String(invoiceId) : '' })
        setSelectedInvoice(null)
      }
      setErrors({})
    }).catch((requestError) => {
      if (active) setLoadError(getErrorMessage(requestError, requestError.message || 'Unable to prepare the credit note form.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [editing, id, preselectedId, reload])

  useEffect(() => {
    const invoiceId = form.invoice_id
    if (!invoiceId || loading || loadError) {
      setSource(null)
      setSourceError('')
      setSourceLoading(false)
      return undefined
    }
    let active = true
    setSource(null)
    setSourceError('')
    setSourceLoading(true)
    creditNoteService.sourceInvoice(invoiceId).then((response) => {
      if (!active) return
      const details = response?.data?.data
      if (!details?.invoice || !Array.isArray(details.creditable_items)) throw new Error('Source invoice details were not returned.')
      setSource(details)
      setSelectedInvoice((previous) => previous?.value === String(invoiceId) ? previous : invoiceChoice(details.invoice))
      setForm((previous) => previous.invoice_id === invoiceId
        ? { ...previous, items: mergeCreditLines(details.creditable_items, previous.items) }
        : previous)
    }).catch((requestError) => {
      if (active) setSourceError(getErrorMessage(requestError, 'Unable to retrieve remaining creditable quantities.'))
    }).finally(() => { if (active) setSourceLoading(false) })
    return () => { active = false }
  }, [form.invoice_id, loading, loadError, sourceReload])

  // Search approved invoices on the server. A fixed first-page dropdown would
  // silently hide invoices in organisations with more than 100 approved records.
  const loadApprovedInvoices = useCallback(async (search) => {
    try {
      const response = await invoiceService.list({ status: 'approved', search: search.trim() || undefined, page: 1, limit: 50 })
      setInvoiceSearchError('')
      return readInvoiceCollection(response).invoices.map(invoiceChoice)
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
    const nextId = option?.value || ''
    setSelectedInvoice(option || null)
    setForm((previous) => ({ ...previous, invoice_id: String(nextId), items: [] }))
    setErrors((previous) => ({ ...previous, invoice_id: undefined, items: undefined }))
  }
  const changeLine = (lineId, changes) => {
    setForm((previous) => ({ ...previous, items: previous.items.map((line) =>
      String(line.invoice_item_id) === String(lineId) ? { ...line, ...changes } : line),
    }))
    setErrors((previous) => ({ ...previous, items: undefined, [`quantity.${lineId}`]: undefined }))
  }
  const estimate = useMemo(() => estimateCredit(form, source), [form, source])
  const current = source?.invoice
  const availableLines = source?.creditable_items || []
  const currency = current?.currency || note?.currency || 'NGN'
  const selectedMap = useMemo(() => new Map(form.items.map((line) => [String(line.invoice_item_id), line])), [form.items])

  const saveDraft = async (submitAfterSave = false) => {
    if (saving || loading || sourceLoading || sourceError) return
    const nextErrors = validateCreditNoteForm(form, source)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast('Review the highlighted credit note fields before saving.', 'warning', 'Required details missing')
      return
    }
    setSaving(true)
    let savedId = 0
    try {
      const response = editing ? await creditNoteService.update(creditNotePayload(form, id)) : await creditNoteService.create(creditNotePayload(form))
      savedId = creditNoteSavedId(response)
      if (!savedId) throw new Error('The server did not confirm a saved credit note. Please check the credit notes list before retrying.')
      if (submitAfterSave) await creditNoteService.submitForApproval(savedId)
      toast(submitAfterSave ? 'Credit note saved and submitted for approval.' : editing ? 'Credit note draft updated successfully.' : 'Credit note draft created successfully.',
        'success', submitAfterSave ? 'Submitted successfully' : 'Draft saved')
      navigate(`/app/credit-notes/${savedId}`, { replace: true })
    } catch (requestError) {
      if (savedId && submitAfterSave) {
        toast(`Draft saved, but not submitted: ${getErrorMessage(requestError, 'Submission failed.')}`, 'warning', 'Submission incomplete')
        navigate(`/app/credit-notes/${savedId}`, { replace: true })
      } else toast(getErrorMessage(requestError, 'Unable to save this credit note.'), 'error', 'Credit note not saved')
    } finally { setSaving(false) }
  }

  if (loading) return <div className={base.page} aria-busy="true"><div className={base.skeleton} /><div className={base.skeleton} /><div className={base.skeleton} /></div>
  if (loadError) return <div className={base.errorState} role="alert"><AlertCircle size={27} /><h2>Credit note form unavailable</h2><p>{loadError}</p>
    <div className={base.errorActions}><Button onClick={() => setReload((n) => n + 1)}>Try again</Button><Button to="/app/credit-notes" variant="secondary">Return to credit notes</Button></div></div>

  const summary = <>
    <Button icon={Save} onClick={() => saveDraft(false)} loading={saving} disabled={sourceLoading || !source} variant="secondary">{editing ? 'Save draft changes' : 'Save as draft'}</Button>
    {canSubmit && <Button icon={Send} onClick={() => saveDraft(true)} loading={saving} disabled={sourceLoading || !source}>Save &amp; submit</Button>}
  </>

  return <div className={`${base.page} fx-enter`}>
    <div className={base.breadcrumb}><Link to="/app/credit-notes"><ArrowLeft size={14} /> Credit Notes</Link><span>/</span><span>{editing ? 'Edit credit note' : 'Create credit note'}</span></div>
    <PageHeader eyebrow="Sales adjustment" title={editing ? `Edit ${creditNoteReferenceLabel(note)}` : 'Create Credit Note'}
      description="Reduce an approved invoice through a controlled draft, approval and balance update workflow."
      actions={<div className={base.headerActions}>{summary}</div>} />
    <div className={base.layout}>
      <main className={base.main}>
        <Panel icon={FileMinus2} eyebrow="Source invoice" title="Credit note details" description="Choose an approved invoice and explain why the adjustment is required.">
          <div className={base.fields}>
            <div className={base.span2}>
              {editing ? <Select id="credit-note-invoice" size="md" label="Approved invoice *" icon={ReceiptText} value={form.invoice_id}
                options={selectedInvoice ? [selectedInvoice] : []} onChange={() => {}} isDisabled hint="The source invoice cannot be changed after the credit note is created." />
                : <Select id="credit-note-invoice" size="md" label="Approved invoice *" icon={ReceiptText} value={selectedInvoice}
                  loadOptions={loadApprovedInvoices} onChange={selectInvoice} isSearchable isClearable
                  placeholder="Search approved invoices..." error={errors.invoice_id || invoiceSearchError}
                  hint="Search by invoice number, customer or reference. Only approved invoices are eligible." />}
            </div>
            <DatePicker id="credit-note-date" label="Credit note date *" value={form.credit_note_date} min={current?.invoice_date || undefined}
              onChange={(value) => update('credit_note_date', value)} error={errors.credit_note_date} />
            <Select id="credit-note-reason-category" size="md" label="Reason category *" value={form.reason_category} options={CREDIT_NOTE_REASON_CATEGORIES}
              onChange={(value) => update('reason_category', value)} error={errors.reason_category} icon={FileText} />
            <div className={base.span2}><TextField id="credit-note-reference" size="md" label="External reference" icon={Hash}
              placeholder="Optional reference" value={form.external_reference} maxLength={120} error={errors.external_reference}
              onChange={(event) => update('external_reference', event.target.value)} /></div>
            <div className={base.span2}><Textarea id="credit-note-reason" label="Reason *" value={form.reason} onChange={(event) => update('reason', event.target.value)}
              rows={3} maxLength={500} error={errors.reason} placeholder="State why this credit note is being raised." /></div>
            <div className={base.span2}><Textarea id="credit-note-notes" label="Internal notes" value={form.notes} onChange={(event) => update('notes', event.target.value)}
              rows={3} maxLength={2000} error={errors.notes} placeholder="Optional internal note for approvers." /></div>
          </div>
        </Panel>
        <Panel icon={ReceiptText} eyebrow="Credit lines" title="Select invoice lines to credit" description="Enter the credited quantities. Pricing and tax are taken from the original invoice."
          aside={source && <span className={base.count}>{estimate.count} selected</span>}>
          {!form.invoice_id ? <p className={base.notice}><Info size={16} /> Choose a source invoice to view its creditable lines.</p>
            : sourceLoading ? <div className={styles.loadingLines} role="status">Loading remaining invoice quantities…</div>
              : sourceError ? <div className={styles.inlineError} role="alert"><AlertCircle size={17} /><span>{sourceError}</span><Button size="sm" variant="secondary" onClick={() => setSourceReload((n) => n + 1)}>Try again</Button></div>
                : !availableLines.length || availableLines.every((line) => Number(line.remaining_quantity || 0) <= 0)
                  ? <p className={base.notice}><Info size={16} /> No remaining creditable quantities are available for this invoice.</p>
                  : <div className={styles.lines}>{availableLines.map((line, index) => {
                    const selected = selectedMap.get(String(line.invoice_item_id))
                    const remaining = Number(line.remaining_quantity || 0)
                    const allowed = remaining > 0
                    const quantity = Number(selected?.quantity || 0)
                    const lineEstimate = allowed && Number.isFinite(quantity) && quantity > 0
                      ? Number(line.remaining_total_amount || 0) * Math.min(quantity, remaining) / remaining : 0
                    return <div key={line.invoice_item_id} className={styles.line} data-selected={selected?.selected || undefined}>
                      <div className={styles.lineTop}>
                        <Checkbox id={`credit-line-${line.invoice_item_id}`} checked={Boolean(selected?.selected)} disabled={!allowed || saving}
                          onChange={(event) => changeLine(line.invoice_item_id, { selected: event.target.checked,
                            quantity: event.target.checked && !selected?.quantity ? String(line.remaining_quantity) : selected?.quantity || '' })}
                          label={line.item_name_snapshot || `Invoice line ${index + 1}`}
                          description={line.item_code_snapshot || line.item_description_snapshot || 'Source invoice item'} />
                        <span className={styles.lineAmount}>Est. <strong className="num">{money(selected?.selected ? lineEstimate : 0, currency)}</strong></span>
                      </div>
                      <div className={styles.lineValues}>
                        <span>Original <strong className="num">{Number(line.original_quantity || 0).toLocaleString('en-NG')} {line.unit_code_snapshot || ''}</strong></span>
                        <span>Already credited <strong className="num">{Number(line.already_credited_quantity || 0).toLocaleString('en-NG')} {line.unit_code_snapshot || ''}</strong></span>
                        <span>Remaining <strong className="num">{remaining.toLocaleString('en-NG')} {line.unit_code_snapshot || ''}</strong></span>
                        <div className={styles.quantityField}><TextField id={`credit-quantity-${line.invoice_item_id}`} size="md" label="Credit quantity"
                          inputMode="decimal" placeholder="0.0000" value={selected?.quantity || ''} disabled={!allowed || saving}
                          error={errors[`quantity.${line.invoice_item_id}`]}
                          onChange={(event) => changeLine(line.invoice_item_id, { quantity: event.target.value, selected: event.target.value.trim() !== '' })} /></div>
                      </div>
                    </div>
                  })}</div>}
          {errors.items && <p className={styles.inlineError} role="alert"><AlertCircle size={16} /> {errors.items}</p>}
          <p className={styles.smallPrint}><Info size={15} /> Values shown here are estimates. The backend prorates the original invoice’s discounts, VAT and rounding when the draft is saved.</p>
        </Panel>
        <div className={styles.bottomActions}>{summary}</div>
      </main>
      <aside className={base.sidebar}>
        <section className={base.summary}>
          <div className={base.summaryHeader}><span><Calculator size={19} /></span><div><h2>Credit impact</h2><p>Live estimate · server calculates final totals</p></div></div>
          <div className={base.summaryBody}>
            {current ? <>
              <dl className={styles.summaryRows}>
                <div><dt>Source invoice</dt><dd className="num ref">{current.invoice_number || `Invoice #${current.id}`}</dd></div>
                <div><dt>Customer</dt><dd>{current.customer_name_snapshot || '—'}</dd></div>
                <div><dt>Invoice total</dt><dd className="num">{money(current.total_amount, currency)}</dd></div>
                <div><dt>Previously credited</dt><dd className="num">{money(current.credited_amount || 0, currency)}</dd></div>
                <div><dt>Selected lines</dt><dd className="num">{estimate.count}</dd></div>
              </dl>
              <div className={base.grandTotal}><span>Estimated credit</span><strong className="num">{money(estimate.total, currency)}</strong></div>
              <p className={styles.smallPrint}><ShieldCheck size={15} /> Final totals are confirmed by the backend on save. NRS transmission is not enabled.</p>
            </> : <p className={base.summaryEmpty}>Choose an approved invoice to see its available credit and original customer details.</p>}
            <Button block icon={Save} onClick={() => saveDraft(false)} loading={saving} disabled={!source || sourceLoading}>Save as draft</Button>
            <p className={base.summaryFoot}><CheckCircle2 size={15} /> Approval applies the credit to the source invoice balance.</p>
          </div>
        </section>
      </aside>
    </div>
  </div>
}
