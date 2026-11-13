import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveAs } from 'file-saver'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Download, FileMinus2, Link2,
  Mail, PencilLine, Printer, ReceiptText, RefreshCw, Send, UserRound, XCircle,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Skeleton from '../../components/ui/Skeleton'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import Modal from '../../components/overlays/Modal'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import DocumentSheet from '../../components/documents/DocumentSheet'
import { DOCUMENT_TYPES } from '../../components/documents/documentModels'
import { hasProductionNrsEvidence } from '../../components/nrs/nrsEvidence'
import NrsUblReadinessPanel from '../../components/nrs/NrsUblReadinessPanel'
import InvoiceSecureLinkDialog from '../invoices/InvoiceSecureLinkDialog'
import creditNoteService from '../../services/creditNoteService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import {
  creditNoteApproved, creditNoteEditable, creditNotePending, creditNoteReasonLabel,
  creditNoteReferenceLabel, creditNoteStatusLabel, creditNoteTone, invoiceMoney,
  readCreditNoteReadiness, safeCreditNoteFilename, validateCreditNoteEmail,
} from './creditNoteDetailsModel'
import styles from '../invoices/InvoiceDetails.module.css'
import creditStyles from './CreditNoteDetails.module.css'
import '../invoices/invoicePrint.css'

const EMAIL_MODES = { TEMPLATE: 'template_only', PDF: 'pdf_attachment' }
const MAX_PDF_ATTACHMENT_BYTES = 4 * 1024 * 1024
const show = (value) => value === undefined || value === null || value === '' ? '—' : value
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the document attachment.'))
  reader.readAsDataURL(blob)
})

function DetailCard({ icon: Icon, title, description, children }) {
  return <section className={styles.card}>
    <div className={styles.cardHeading}><span className={styles.cardIcon}><Icon size={18} aria-hidden="true" /></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
    {children}
  </section>
}
function DetailRow({ label, value, number = false }) {
  return <div className={styles.detailRow}><dt>{label}</dt><dd className={number ? 'num' : undefined}>{show(value)}</dd></div>
}
function PageSkeleton() {
  return <div className={styles.page} aria-busy="true" aria-label="Loading credit note details">
    <Skeleton width="125px" height="18px" />
    <div className={styles.hero}><Skeleton width="40%" height="32px" /><Skeleton width="65%" height="17px" /></div>
    <div className={styles.summaryGrid}>{[0, 1, 2].map((key) => <div className={styles.card} key={key}><Skeleton height="18px" /><Skeleton height="36px" /><Skeleton height="14px" /></div>)}</div>
    <div className={styles.card}>{[0, 1, 2, 3].map((key) => <Skeleton key={key} height="28px" />)}</div>
  </div>
}

function SendCreditNoteDialog({ open, note, busy, error, onClose, onSend }) {
  const [form, setForm] = useState({ recipient_email: '', recipient_name: '', message: '', delivery_mode: EMAIL_MODES.TEMPLATE })
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (!open) return
    setForm({ recipient_email: note?.customer_email_snapshot || '', recipient_name: note?.customer_name_snapshot || '', message: '', delivery_mode: EMAIL_MODES.TEMPLATE })
    setErrors({})
  }, [open, note?.id])
  const change = (key, value) => { setForm((previous) => ({ ...previous, [key]: value })); setErrors((previous) => ({ ...previous, [key]: '' })) }
  const submit = () => {
    const next = validateCreditNoteEmail(form)
    setErrors(next)
    if (!Object.keys(next).length) onSend(form)
  }
  return <Modal open={open} title="Send credit note to customer" eyebrow="Customer delivery"
    description="Confirm the recipient details and choose whether to attach a PDF or send only the branded email template."
    size="lg" onClose={onClose} busy={busy}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button icon={Mail} loading={busy} onClick={submit}>{form.delivery_mode === EMAIL_MODES.PDF ? 'Send with PDF' : 'Send credit note'}</Button></>}>
    <div className={styles.modalFields}>
      {error && <Alert tone="danger" title="Credit note not sent">{error}</Alert>}
      <fieldset className={styles.deliveryModes}><legend>Delivery option</legend>
        <label data-selected={form.delivery_mode === EMAIL_MODES.TEMPLATE}><input type="radio" name="credit_note_delivery_mode" checked={form.delivery_mode === EMAIL_MODES.TEMPLATE} onChange={() => change('delivery_mode', EMAIL_MODES.TEMPLATE)} /><span><strong>Template only</strong><small>Branded credit note email without an attachment.</small></span></label>
        <label data-selected={form.delivery_mode === EMAIL_MODES.PDF}><input type="radio" name="credit_note_delivery_mode" checked={form.delivery_mode === EMAIL_MODES.PDF} onChange={() => change('delivery_mode', EMAIL_MODES.PDF)} /><span><strong>Attach PDF</strong><small>Include the generated credit note PDF with the email template.</small></span></label>
      </fieldset>
      <div className={styles.formGrid}>
        <TextField label="Customer email" type="email" value={form.recipient_email} onChange={(event) => change('recipient_email', event.target.value)} error={errors.recipient_email} autoComplete="email" />
        <TextField label="Recipient name" value={form.recipient_name} onChange={(event) => change('recipient_name', event.target.value)} error={errors.recipient_name} maxLength={120} />
      </div>
      <Textarea label="Optional message" value={form.message} onChange={(event) => change('message', event.target.value)} error={errors.message} maxLength={1200} rows={4} />
    </div>
  </Modal>
}

export default function CreditNoteDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canEdit = hasPermission(permissions, 'credit_notes.edit')
  const canApprove = hasPermission(permissions, 'credit_notes.approve')
  const canSend = hasPermission(permissions, 'credit_notes.send')
  const canLinks = hasPermission(permissions, 'portal_links.manage')
  const canViewInvoice = hasPermission(permissions, 'invoices.view')

  const [note, setNote] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [confirmAction, setConfirmAction] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [readinessBusy, setReadinessBusy] = useState(false)
  const [readiness, setReadiness] = useState(null)
  const [readinessError, setReadinessError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(820)
  const previewRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNote(null)
    setOrganization(null)
    setDeliveries([])
    setLogoDataUrl('')
    setReadiness(null)
    setReadinessError('')
    setError('')
    const load = async () => {
      try {
        const response = await creditNoteService.document(id)
        const data = response.data?.data || {}
        if (!active) return
        if (!data.credit_note) throw new Error('Credit note details were not returned by the server.')
        setNote(data.credit_note)
        setOrganization(data.organization || null)
        setDeliveries(Array.isArray(data.delivery_history) ? data.delivery_history : [])
        if (data.organization?.logo_available) {
          try {
            const logo = await creditNoteService.organizationLogo()
            const uri = await blobToDataUrl(logo.data)
            if (active) setLogoDataUrl(uri)
          } catch { if (active) setLogoDataUrl('') }
        }
      } catch (requestError) { if (active) setError(getErrorMessage(requestError, 'Unable to retrieve this credit note.')) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id, revision])

  useEffect(() => {
    const area = previewRef.current
    if (!area) return undefined
    const update = () => setPreviewWidth(area.getBoundingClientRect().width)
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update)
      observer.observe(area)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [loading])

  const model = useMemo(() => note && organization ? DOCUMENT_TYPES.credit_note.build(note, organization, logoDataUrl) : null, [note, organization, logoDataUrl])
  const previewScale = Math.max(0.1, Math.min(1, (previewWidth - 4) / 820))
  const money = (value) => invoiceMoney(value, note?.currency)
  const approved = creditNoteApproved(note)
  const editable = creditNoteEditable(note)
  const pending = creditNotePending(note)
  const verifiedNrs = hasProductionNrsEvidence(note?.nrs_evidence)
  const deliveryCount = Number(note?.sent_count ?? deliveries.length)
  const sourceReference = note?.invoice_number || (note?.invoice_id ? `Invoice #${note.invoice_id}` : 'Source invoice')
  const pdfBlob = async () => {
    if (!model) throw new Error('Credit note document details are unavailable. Refresh the page and try again.')
    const { renderDocumentPdf } = await import('../../components/documents/pdf')
    return renderDocumentPdf(model)
  }
  const downloadPdf = async () => {
    if (!approved || !model || pdfBusy) return
    setPdfBusy(true)
    try { saveAs(await pdfBlob(), `${safeCreditNoteFilename(note)}.pdf`); toast('Credit note PDF generated successfully.', 'success', 'PDF ready') }
    catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate the credit note PDF.'), 'error', 'PDF not generated') }
    finally { setPdfBusy(false) }
  }
  const prepareReadiness = async () => {
    if (!approved || readinessBusy) return
    setReadinessBusy(true)
    setReadinessError('')
    setReadiness(null)
    try {
      const response = await creditNoteService.prepareNrsReadiness(note.id)
      const result = readCreditNoteReadiness(response)
      setReadiness(result)
      toast(result.schema_valid === true ? 'Local UBL check passed; NRS has not been contacted.' : 'Review the NRS UBL issues below.', result.schema_valid === true ? 'success' : 'warning', 'Offline readiness')
    } catch (requestError) { setReadinessError(getErrorMessage(requestError, 'Unable to check credit-note readiness.')) }
    finally { setReadinessBusy(false) }
  }
  const completeAction = async () => {
    const action = confirmAction
    if (!note || !action || actionBusy) return
    if (action === 'return' && !returnReason.trim()) { setReturnError('Provide a correction reason before returning this credit note.'); return }
    if (action === 'return' && returnReason.trim().length > 500) { setReturnError('Correction reason must be 500 characters or less.'); return }
    setActionBusy(true)
    try {
      if (action === 'submit') await creditNoteService.submitForApproval(note.id)
      else if (action === 'approve') await creditNoteService.approve(note.id)
      else if (action === 'return') await creditNoteService.returnForCorrection(note.id, returnReason.trim())
      else if (action === 'archive') await creditNoteService.archive(note.id)
      const messages = {
        submit: ['Credit note submitted for approval.', 'Submitted successfully'],
        approve: ['Credit note approved and invoice balance updated.', 'Credit note approved'],
        return: ['Credit note returned to the preparer for correction.', 'Correction requested'],
        archive: ['Credit note draft archived.', 'Credit note archived'],
      }
      toast(messages[action][0], 'success', messages[action][1])
      setConfirmAction('')
      setReturnReason('')
      setReturnError('')
      if (action === 'archive') navigate('/app/credit-notes', { replace: true })
      else setRevision((value) => value + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to complete credit note action.'), 'error', 'Action unsuccessful') }
    finally { setActionBusy(false) }
  }
  const sendCreditNote = async (form) => {
    if (!approved || !canSend || sendBusy) return
    setSendBusy(true)
    setSendError('')
    try {
      let attachment = null
      if (form.delivery_mode === EMAIL_MODES.PDF) {
        const blob = await pdfBlob()
        if (blob.size > MAX_PDF_ATTACHMENT_BYTES) throw new Error('The credit note PDF is too large to attach. Choose template-only delivery or reduce document details.')
        const uri = await blobToDataUrl(blob)
        attachment = { filename: `${safeCreditNoteFilename(note)}.pdf`, mime_type: 'application/pdf', content_base64: uri.split(',')[1], size_bytes: blob.size }
      }
      const response = await creditNoteService.sendToCustomer({
        id: note.id, recipient_email: form.recipient_email.trim(), recipient_name: form.recipient_name.trim(),
        message: form.message.trim(), delivery_mode: form.delivery_mode, pdf_attachment: attachment,
      })
      setSendOpen(false)
      toast(response.data?.message || 'Credit note sent to customer successfully.', 'success', 'Credit note sent')
      setRevision((value) => value + 1)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send credit note to the customer.')) }
    finally { setSendBusy(false) }
  }

  if (loading) return <PageSkeleton />
  if (error || !note) return <div className={`${styles.page} fx-enter`}>
    <Link to="/app/credit-notes" className={styles.back}><ArrowLeft size={16} /> Credit notes</Link>
    <div className={styles.unavailable} role="alert"><FileMinus2 size={34} aria-hidden="true" /><h1>Credit note unavailable</h1><p>{error || 'This credit note could not be found.'}</p><div className={styles.actions}><Button variant="secondary" to="/app/credit-notes" icon={ArrowLeft}>Back to credit notes</Button><Button icon={RefreshCw} onClick={() => setRevision((value) => value + 1)}>Try again</Button></div></div>
  </div>

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link to="/app/credit-notes" className={styles.back}><ArrowLeft size={16} /> Credit notes</Link>
      <div className={styles.actions}>
        {canEdit && editable && <Button variant="secondary" icon={PencilLine} to={`/app/credit-notes/${note.id}/edit`}>Edit draft</Button>}
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setRevision((value) => value + 1)}>Refresh</Button>
      </div>
    </div>
    <header className={styles.hero} aria-labelledby="credit-note-detail-title">
      <div className={styles.heroTop}><span className={styles.heroIcon}><FileMinus2 size={25} aria-hidden="true" /></span>
        <div className={styles.heroText}><span className={styles.eyebrow}>Credit note</span><h1 id="credit-note-detail-title" className="num ref">{creditNoteReferenceLabel(note)}</h1><p>{note.customer_name_snapshot || 'Unknown customer'} · {formatDate(note.credit_note_date)} · {creditNoteReasonLabel(note.reason_category)}</p></div>
        <div className={styles.badges}><StatusBadge label={creditNoteStatusLabel(note.status)} tone={creditNoteTone(note.status)} /></div>
      </div>
      {note.status === 'rejected' && <Alert tone="warning" title="Returned for correction">{note.rejection_reason || 'Review and update this credit note before resubmitting.'}</Alert>}
      <div className={styles.heroActions} aria-label="Credit note workflow actions">
        {canEdit && editable && <Button icon={Send} onClick={() => setConfirmAction('submit')}>Submit for approval</Button>}
        {canApprove && pending && <><Button variant="secondary" icon={XCircle} onClick={() => setConfirmAction('return')}>Return for correction</Button><Button icon={CheckCircle2} onClick={() => setConfirmAction('approve')}>Approve credit note</Button></>}
      </div>
    </header>

    <div className={styles.summaryGrid}>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><FileMinus2 size={19} /></span><span>Total credit amount</span><strong className="num">{money(note.total_amount)}</strong><small>{approved ? `Applied to ${sourceReference}` : `To be applied to ${sourceReference} after approval`}</small></section>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><ReceiptText size={19} /></span><span>Source invoice balance</span><strong className="num">{money(note.invoice_balance_due)}</strong><small>Invoice credited to date: {money(note.invoice_credited_amount)}</small></section>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><CheckCircle2 size={19} /></span><span>NRS / MBS status</span><StatusBadge label={verifiedNrs ? 'Verified production evidence' : 'Not yet submitted to NRS'} tone={verifiedNrs ? 'success' : 'neutral'} /><small>Offline validation and customer delivery do not constitute regulatory clearance.</small></section>
    </div>

    <div className={styles.twoCol}>
      <DetailCard icon={ReceiptText} title="Source invoice" description="This credit note adjusts the original approved invoice.">
        <dl className={styles.details}>
          <DetailRow label="Invoice" value={canViewInvoice && note.invoice_id ? <Link className={creditStyles.sourceLink} to={`/app/invoices/${note.invoice_id}`}>{sourceReference}</Link> : sourceReference} />
          <DetailRow label="Invoice date" value={formatDate(note.invoice_date)} number />
          <DetailRow label="Original total" value={money(note.invoice_total_amount)} number />
          <DetailRow label="Amount paid" value={money(note.invoice_amount_paid)} number />
          <DetailRow label="Credited so far" value={money(note.invoice_credited_amount)} number />
          <DetailRow label="Current balance" value={money(note.invoice_balance_due)} number />
        </dl>
      </DetailCard>
      <DetailCard icon={UserRound} title="Customer snapshot" description="Buyer information recorded on this credit note.">
        <dl className={styles.details}>
          <DetailRow label="Customer" value={note.customer_name_snapshot} />
          <DetailRow label="Email" value={note.customer_email_snapshot} />
          <DetailRow label="Phone" value={note.customer_phone_snapshot} />
          <DetailRow label="TIN" value={note.customer_tin_snapshot} number />
          <DetailRow label="Billing address" value={note.customer_address_snapshot} />
        </dl>
      </DetailCard>
    </div>

    <DetailCard icon={FileMinus2} title="Credited lines" description="Quantities, discounts and tax reversals recorded against the source invoice.">
      <div className={styles.tableScroll}><table className={styles.linesTable}><thead><tr><th>Description</th><th>Qty / unit</th><th>Unit price</th><th>Discount</th><th>VAT reversed</th><th>Credit total</th></tr></thead><tbody>
        {(note.items || []).length ? note.items.map((line, index) => <tr key={line.id || index}>
          <td><strong>{line.item_name_snapshot || 'Credited item'}</strong><small>{line.item_description_snapshot || line.item_code_snapshot || '—'}</small></td>
          <td className="num">{Number(line.quantity || 0).toLocaleString('en-NG')} {line.unit_code_snapshot || ''}</td>
          <td className="num">{money(line.unit_price)}</td>
          <td className="num">{money(Number(line.line_discount_amount || 0) + Number(line.invoice_discount_allocated_amount || 0))}</td>
          <td className="num">{money(line.tax_amount)}</td>
          <td className="num"><strong>{money(line.total_amount)}</strong></td>
        </tr>) : <tr><td colSpan="6" className={styles.noLines}>No credited items were returned for this credit note.</td></tr>}</tbody></table></div>
      <dl className={styles.totals}>
        <DetailRow label="Subtotal" value={money(note.subtotal_amount)} number />
        <DetailRow label="Line discounts" value={`− ${money(note.line_discount_amount)}`} number />
        <DetailRow label="Invoice discount" value={`− ${money(note.invoice_discount_amount)}`} number />
        <DetailRow label="Net amount" value={money(note.net_amount)} number />
        <DetailRow label="VAT / Tax reversed" value={money(note.tax_amount)} number />
        <div className={styles.grandTotal}><dt>Total credit</dt><dd className="num">{money(note.total_amount)}</dd></div>
      </dl>
    </DetailCard>

    <section className={styles.compliance} aria-labelledby="credit-note-nrs-heading">
      <div className={styles.complianceHead}><div><p className={styles.eyebrow}>NRS / MBS readiness</p><h2 id="credit-note-nrs-heading">Credit note UBL offline validation</h2><p>Local checks identify data to correct before future submission. They do not contact NRS or issue clearance.</p></div>
        <Button icon={RefreshCw} loading={readinessBusy} disabled={!approved} onClick={prepareReadiness}>Run offline UBL check</Button>
      </div>
      {!approved && <Alert tone="info" title="Approval required">Approve this credit note before running the local readiness check.</Alert>}
      {readinessError && <Alert tone="danger" title="Readiness check failed">{readinessError}</Alert>}
      <NrsUblReadinessPanel validation={readiness} title="NRS credit-note UBL offline check" documentLabel="Credit note" />
      <p className={creditStyles.caption}>This credit-note check is not saved to the document; run it again after changing business, buyer or catalogue information. Live NRS submission remains disabled.</p>
    </section>

    <DetailCard icon={Printer} title="Credit note output" description={approved ? 'Print, download or send the approved credit note.' : 'Preview only: customer-facing output unlocks after approval.'}>
      <div className={styles.outputActions}>
        <Button variant="secondary" icon={Printer} disabled={!approved || !model} onClick={() => window.print()}>Print</Button>
        <Button variant="secondary" icon={Download} disabled={!approved || !model} loading={pdfBusy} onClick={downloadPdf}>Download PDF</Button>
        {canSend && <Button icon={Mail} disabled={!approved || !model} onClick={() => { setSendError(''); setSendOpen(true) }}>Send to customer</Button>}
        {canLinks && <Button variant="secondary" icon={Link2} disabled={!approved} onClick={() => setLinkOpen(true)}>Secure link</Button>}
      </div>
      <div className={styles.deliveryStrip}><span><strong className="num">{Number.isFinite(deliveryCount) ? deliveryCount : 0}</strong> email sends</span><span>Last sent: {note.last_sent_at ? formatDate(note.last_sent_at) : 'Not sent yet'}</span><span>Sent by: {note.last_sent_by_name || '—'}</span></div>
      <div className={styles.previewArea} ref={previewRef} aria-label="Credit note document preview">
        {model ? <div className={styles.scaledPreview} style={{ zoom: previewScale }}><DocumentSheet model={model} /></div> : <p className={styles.previewUnavailable}>Document preview unavailable because organisation details were not returned.</p>}
      </div>
    </DetailCard>

    <div className={styles.twoCol}>
      <DetailCard icon={CalendarDays} title="Reason and notes" description="Credit adjustment classification and supporting context.">
        <dl className={styles.details}>
          <DetailRow label="Credit note date" value={formatDate(note.credit_note_date)} number />
          <DetailRow label="Reason category" value={creditNoteReasonLabel(note.reason_category)} />
          <DetailRow label="External reference" value={note.external_reference} />
          <DetailRow label="Created by" value={note.created_by_name} />
          <DetailRow label="Approved by" value={note.approved_by_name} />
        </dl>
        <p className={creditStyles.reasonText}>{note.reason || 'No additional credit reason supplied.'}</p>
        {note.notes && <p className={creditStyles.noteText}>{note.notes}</p>}
      </DetailCard>
      <DetailCard icon={Clock3} title="Workflow history">
        <div className={styles.history}>{Array.isArray(note.status_history) && note.status_history.length ? note.status_history.map((entry, index) => <div key={`${entry.created_at}-${index}`}>
          <strong>{String(entry.action || 'Updated').replaceAll('_', ' ')}</strong>
          <small>{entry.changed_by_name || 'Team member'} · {formatDate(entry.created_at)}</small>
          {entry.reason && <p>{entry.reason}</p>}
        </div>) : <p className={styles.textBlock}>No workflow changes have been recorded.</p>}</div>
      </DetailCard>
    </div>

    {canEdit && editable && <button type="button" className={styles.archive} onClick={() => setConfirmAction('archive')}><Archive size={15} aria-hidden="true" /> Archive this draft credit note</button>}
    <ConfirmDialog open={['submit', 'approve', 'archive'].includes(confirmAction)}
      title={{ submit: 'Submit credit note for approval?', approve: 'Approve credit note?', archive: 'Archive draft credit note?' }[confirmAction]}
      message={{ submit: 'Once submitted, the draft will be locked until it is approved or returned for correction.', approve: 'Approval assigns the credit note number and reduces the source invoice/customer balance. NRS submission is not part of this action.', archive: 'This removes the draft from active credit note workflows. Approved credit notes cannot be archived here.' }[confirmAction]}
      confirmLabel={{ submit: 'Submit credit note', approve: 'Approve credit note', archive: 'Archive draft' }[confirmAction]}
      variant={confirmAction === 'archive' ? 'danger' : 'primary'} loading={actionBusy} onConfirm={completeAction} onClose={() => !actionBusy && setConfirmAction('')} />
    <Modal open={confirmAction === 'return'} title="Return credit note for correction?" size="sm" busy={actionBusy}
      description="State what should be corrected before this credit note is resubmitted for approval."
      onClose={() => !actionBusy && setConfirmAction('')}
      footer={<><Button variant="secondary" onClick={() => setConfirmAction('')} disabled={actionBusy}>Cancel</Button><Button variant="danger" loading={actionBusy} onClick={completeAction}>Return credit note</Button></>}>
      <Textarea label="Correction reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value); setReturnError('') }} error={returnError} maxLength={500} rows={4} placeholder="Example: Adjust the credited quantity and reason category." />
    </Modal>
    <SendCreditNoteDialog open={sendOpen} note={note} busy={sendBusy} error={sendError} onClose={() => !sendBusy && setSendOpen(false)} onSend={sendCreditNote} />
    {canLinks && <InvoiceSecureLinkDialog open={linkOpen} documentType="credit_note" document={note} onClose={() => setLinkOpen(false)} toast={toast} />}
    {approved && model && createPortal(<div className="di-invoice-print-portal"><DocumentSheet model={model} /></div>, document.body)}
  </div>
}
