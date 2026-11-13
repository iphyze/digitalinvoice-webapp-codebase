import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { AlertTriangle, Archive, ArrowLeft, Banknote, CalendarDays, CheckCircle2, Clock3, Download,
  FileMinus2, Link2, Mail, PencilLine, Printer, ReceiptText, RefreshCw,
  Send, Truck, UserRound, XCircle, ShieldCheck } from 'lucide-react'
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
import NrsQueueStatus from '../../components/nrs/NrsQueueStatus'
import InvoicePaymentDialog from './InvoicePaymentDialog'
import InvoiceSecureLinkDialog from './InvoiceSecureLinkDialog'
import invoiceService from '../../services/invoiceService'
import firsService from '../../services/firsService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { invoiceReferenceLabel, paymentStatusLabel, readinessLabel, readinessTone, statusLabel, statusTone } from './invoiceListOptions'
import { readInvoiceQueue } from './invoiceQueueStatus'
import { invoiceApproved, invoiceEditable, invoiceMoney, invoicePending, parseLocalNrsReadiness, safeInvoiceFilename, snapshotClassification, validateInvoiceEmail } from './invoiceDetailsModel'
import styles from './InvoiceDetails.module.css'
import './invoicePrint.css'

const EMAIL_MODES = { TEMPLATE: 'template_only', PDF: 'pdf_attachment' }
const MAX_PDF_ATTACHMENT_BYTES = 4 * 1024 * 1024
const show = (value) => value === undefined || value === null || value === '' ? '—' : value

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the logo or PDF attachment.'))
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
  return <div className={styles.page} aria-busy="true" aria-label="Loading invoice details">
    <Skeleton width="125px" height="18px" />
    <div className={styles.hero}><Skeleton width="40%" height="32px" /><Skeleton width="65%" height="17px" /></div>
    <div className={styles.summaryGrid}>{[0, 1, 2].map((key) => <div className={styles.card} key={key}><Skeleton height="18px" /><Skeleton height="36px" /><Skeleton height="14px" /></div>)}</div>
    <div className={styles.card}>{[0, 1, 2, 3].map((key) => <Skeleton key={key} height="28px" />)}</div>
  </div>
}

function SendInvoiceDialog({ open, invoice, busy, error, onClose, onSend }) {
  const [form, setForm] = useState({ recipient_email: '', recipient_name: '', message: '', delivery_mode: EMAIL_MODES.TEMPLATE })
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (open) {
      setForm({ recipient_email: invoice?.customer_email_snapshot || '', recipient_name: invoice?.customer_name_snapshot || '', message: '', delivery_mode: EMAIL_MODES.TEMPLATE })
      setErrors({})
    }
  }, [open, invoice?.id])
  const change = (key, value) => { setForm((previous) => ({ ...previous, [key]: value })); setErrors((previous) => ({ ...previous, [key]: '' })) }
  const submit = () => {
    const next = validateInvoiceEmail(form)
    setErrors(next)
    if (!Object.keys(next).length) onSend(form)
  }
  return <Modal open={open} title="Send invoice to customer" eyebrow="Customer delivery"
    description="Confirm the recipient and choose between a branded email template and a PDF attachment."
    size="lg" onClose={onClose} busy={busy} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button icon={Mail} loading={busy} onClick={submit}>{form.delivery_mode === EMAIL_MODES.PDF ? 'Send with PDF' : 'Send invoice'}</Button></>}>
    <div className={styles.modalFields}>
      {error && <Alert tone="danger" title="Invoice not sent">{error}</Alert>}
      <fieldset className={styles.deliveryModes}><legend>Delivery option</legend>
        <label data-selected={form.delivery_mode === EMAIL_MODES.TEMPLATE}><input type="radio" name="invoice_delivery_mode" checked={form.delivery_mode === EMAIL_MODES.TEMPLATE} onChange={() => change('delivery_mode', EMAIL_MODES.TEMPLATE)} /><span><strong>Template only</strong><small>Branded invoice email without an attachment.</small></span></label>
        <label data-selected={form.delivery_mode === EMAIL_MODES.PDF}><input type="radio" name="invoice_delivery_mode" checked={form.delivery_mode === EMAIL_MODES.PDF} onChange={() => change('delivery_mode', EMAIL_MODES.PDF)} /><span><strong>Attach PDF</strong><small>Include the generated PDF with the email template.</small></span></label>
      </fieldset>
      <div className={styles.formGrid}>
        <TextField label="Customer email" type="email" value={form.recipient_email} onChange={(event) => change('recipient_email', event.target.value)} error={errors.recipient_email} autoComplete="email" />
        <TextField label="Recipient name" value={form.recipient_name} onChange={(event) => change('recipient_name', event.target.value)} error={errors.recipient_name} maxLength={120} />
      </div>
      <Textarea label="Optional message" value={form.message} onChange={(event) => change('message', event.target.value)} maxLength={1200} error={errors.message} rows={4} />
    </div>
  </Modal>
}

export default function InvoiceDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canEdit = hasPermission(permissions, 'invoices.edit')
  const canApprove = hasPermission(permissions, 'invoices.approve')
  const canSend = hasPermission(permissions, 'invoices.send')
  const canPay = hasPermission(permissions, 'payments.record')
  const canLinks = hasPermission(permissions, 'portal_links.manage')
  const canCredit = hasPermission(permissions, 'credit_notes.create')
  const canDeliver = hasPermission(permissions, 'delivery_notes.create')

  const [invoice, setInvoice] = useState(null)
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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [queue, setQueue] = useState(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [queueRevision, setQueueRevision] = useState(0)
  const [previewWidth, setPreviewWidth] = useState(820)
  const previewRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setInvoice(null)
    setOrganization(null)
    setLogoDataUrl('')
    setDeliveries([])
    setError('')
    const load = async () => {
      try {
        const response = await invoiceService.document(id)
        const data = response.data?.data || {}
        if (!active) return
        if (!data.invoice) throw new Error('Invoice details were not returned by the server.')
        setInvoice(data.invoice)
        setOrganization(data.organization || null)
        setDeliveries(Array.isArray(data.delivery_history) ? data.delivery_history : [])
        // Use a data URL (not a short-lived blob URL) for the common screen + PDF model.
        if (data.organization?.logo_available) {
          try {
            const logo = await invoiceService.organizationLogo()
            const uri = await blobToDataUrl(logo.data)
            if (active) setLogoDataUrl(uri)
          } catch { if (active) setLogoDataUrl('') }
        }
      } catch (requestError) { if (active) setError(getErrorMessage(requestError, 'Unable to retrieve this invoice.')) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id, revision])

  useEffect(() => {
    if (!invoiceApproved(invoice)) { setQueue(null); setQueueError(''); setQueueBusy(false); return undefined }
    let active = true
    setQueueBusy(true)
    setQueueError('')
    setQueue(null)
    firsService.submissionQueue(invoice.id).then((response) => { if (active) setQueue(readInvoiceQueue(response)) })
      .catch((requestError) => { if (active) setQueueError(getErrorMessage(requestError, 'Unable to check the local queue.')) })
      .finally(() => { if (active) setQueueBusy(false) })
    return () => { active = false }
  }, [invoice?.id, invoice?.status, queueRevision, revision])

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

  const model = useMemo(() => invoice && organization ? DOCUMENT_TYPES.invoice.build(invoice, organization, logoDataUrl) : null, [invoice, organization, logoDataUrl])
  const previewScale = Math.max(0.1, Math.min(1, (previewWidth - 4) / 820))
  const money = (value) => invoiceMoney(value, invoice?.currency)
  const approved = invoiceApproved(invoice)
  const verifiedNrs = hasProductionNrsEvidence(invoice?.nrs_evidence)
  const editable = invoiceEditable(invoice)
  const pending = invoicePending(invoice)
  const balance = Math.max(0, Number(invoice?.balance_due ?? 0))
  const localReadiness = parseLocalNrsReadiness(invoice?.nrs_last_response)
  const checks = Array.isArray(localReadiness?.checks) ? localReadiness.checks : []
  const readinessIssues = Array.isArray(localReadiness?.errors) ? localReadiness.errors : []
  const readinessWarnings = Array.isArray(localReadiness?.warnings) ? localReadiness.warnings : []
  const deliveryCount = Number(invoice?.sent_count ?? deliveries.length)
  const printInvoice = () => { if (approved && model) window.print() }
  const pdfBlob = async () => {
    if (!model) throw new Error('Invoice document details are unavailable. Refresh the page and try again.')
    const { renderDocumentPdf } = await import('../../components/documents/pdf')
    return renderDocumentPdf(model)
  }
  const downloadPdf = async () => {
    if (!approved || pdfBusy || !model) return
    setPdfBusy(true)
    try { saveAs(await pdfBlob(), `${safeInvoiceFilename(invoice)}.pdf`); toast('Invoice PDF generated successfully.', 'success', 'PDF ready') }
    catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate the invoice PDF.'), 'error', 'PDF not generated') }
    finally { setPdfBusy(false) }
  }
  const prepareReadiness = async () => {
    if (!approved || readinessBusy) return
    setReadinessBusy(true)
    try {
      const response = await invoiceService.prepareFirsReadiness(invoice.id)
      const ready = response.data?.data?.readiness_status === 'ready'
      toast(ready ? 'Local UBL structure passed. NRS has not validated or cleared this invoice.' : 'Invoice payload needs attention before future FIRS/MBS submission.', ready ? 'success' : 'warning', ready ? 'NRS local preflight passed' : 'NRS local preflight blocked')
      setRevision((count) => count + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to prepare this invoice for FIRS/MBS readiness.'), 'error', 'Readiness check failed') }
    finally { setReadinessBusy(false) }
  }
  const completeAction = async () => {
    const action = confirmAction
    if (!invoice || !action || actionBusy) return
    if (action === 'return' && !returnReason.trim()) { setReturnError('Provide a correction reason before returning this invoice.'); return }
    setActionBusy(true)
    try {
      if (action === 'submit') await invoiceService.submitForApproval(invoice.id)
      else if (action === 'approve') await invoiceService.approve(invoice.id)
      else if (action === 'return') await invoiceService.returnForCorrection(invoice.id, returnReason.trim())
      else if (action === 'archive') await invoiceService.archive(invoice.id)
      const messages = {
        submit: ['Invoice submitted for approval.', 'Submitted successfully'],
        approve: ['Invoice approved and an official invoice number has been assigned.', 'Invoice approved'],
        return: ['Invoice returned to the preparer for correction.', 'Correction requested'],
        archive: ['Invoice draft archived.', 'Invoice archived'],
      }
      toast(messages[action][0], 'success', messages[action][1])
      setConfirmAction('')
      setReturnReason('')
      setReturnError('')
      if (action === 'archive') navigate('/app/invoices', { replace: true })
      else setRevision((count) => count + 1)
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to complete invoice action.'), 'error', 'Action unsuccessful') }
    finally { setActionBusy(false) }
  }
  const sendInvoice = async (form) => {
    if (!approved || !canSend || sendBusy) return
    setSendBusy(true)
    setSendError('')
    try {
      let attachment = null
      if (form.delivery_mode === EMAIL_MODES.PDF) {
        const blob = await pdfBlob()
        if (blob.size > MAX_PDF_ATTACHMENT_BYTES) throw new Error('The invoice PDF is too large to attach. Choose template-only delivery or reduce invoice details.')
        const dataUrl = await blobToDataUrl(blob)
        attachment = { filename: `${safeInvoiceFilename(invoice)}.pdf`, mime_type: 'application/pdf', content_base64: dataUrl.split(',')[1], size_bytes: blob.size }
      }
      const response = await invoiceService.sendToCustomer({
        id: invoice.id, recipient_email: form.recipient_email.trim(), recipient_name: form.recipient_name.trim(),
        message: form.message.trim(), delivery_mode: form.delivery_mode, pdf_attachment: attachment,
      })
      setSendOpen(false)
      toast(response.data?.message || 'Invoice sent to customer successfully.', 'success', 'Invoice sent')
      setRevision((count) => count + 1)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send invoice to the customer.')) }
    finally { setSendBusy(false) }
  }

  if (loading) return <PageSkeleton />
  if (error || !invoice) return <div className={`${styles.page} fx-enter`}>
    <Link to="/app/invoices" className={styles.back}><ArrowLeft size={16} /> Invoices</Link>
    <div className={styles.unavailable} role="alert"><ReceiptText size={34} aria-hidden="true" /><h1>Invoice unavailable</h1><p>{error || 'This invoice could not be found.'}</p><div className={styles.actions}><Button variant="secondary" to="/app/invoices" icon={ArrowLeft}>Back to invoices</Button><Button icon={RefreshCw} onClick={() => setRevision((count) => count + 1)}>Try again</Button></div></div>
  </div>

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link className={styles.back} to="/app/invoices"><ArrowLeft size={16} /> Invoices</Link>
      <div className={styles.actions}>
        {canEdit && editable && <Button variant="secondary" icon={PencilLine} to={`/app/invoices/${invoice.id}/edit`}>Edit draft</Button>}
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setRevision((count) => count + 1)}>Refresh</Button>
      </div>
    </div>

    <section className={styles.hero} aria-labelledby="invoice-detail-title">
      <div className={styles.heroTop}><span className={styles.heroIcon}><ReceiptText size={25} aria-hidden="true" /></span>
        <div className={styles.heroText}><span className={styles.eyebrow}>Sales invoice</span><h1 id="invoice-detail-title" className="num ref">{invoiceReferenceLabel(invoice)}</h1><p>{invoice.customer_name_snapshot || 'Unknown customer'} · {formatDate(invoice.invoice_date)} to {formatDate(invoice.due_date)}</p></div>
        <div className={styles.badges}><StatusBadge label={statusLabel(invoice.status)} tone={statusTone(invoice.status)} />{approved && <StatusBadge label={paymentStatusLabel(invoice.payment_status)} />}
          <StatusBadge label={verifiedNrs ? 'Verified production NRS evidence' : 'Not yet submitted to NRS'} tone={verifiedNrs ? 'success' : 'neutral'} /></div>
      </div>
      {invoice.status === 'rejected' && <Alert tone="warning" title="Returned for correction">{invoice.rejection_reason || 'This invoice requires changes before resubmission.'}</Alert>}
      <div className={styles.heroActions} aria-label="Invoice workflow actions">
        {canPay && approved && balance > 0 && <Button icon={Banknote} onClick={() => setPaymentOpen(true)}>Record payment</Button>}
        {canEdit && editable && <Button icon={Send} onClick={() => setConfirmAction('submit')}>Submit for approval</Button>}
        {canApprove && pending && <><Button variant="secondary" icon={XCircle} onClick={() => setConfirmAction('return')}>Return for correction</Button><Button icon={CheckCircle2} onClick={() => setConfirmAction('approve')}>Approve invoice</Button></>}
        {approved && canCredit && <Button variant="secondary" icon={FileMinus2} to={`/app/credit-notes/new?invoice=${invoice.id}`}>Create credit note</Button>}
        {approved && canDeliver && <Button variant="secondary" icon={Truck} to={`/app/delivery-notes/new?invoice=${invoice.id}`}>Create delivery note</Button>}
      </div>
    </section>

    <div className={styles.summaryGrid}>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><ReceiptText size={19} /></span><span>Total invoice amount</span><strong className="num">{money(invoice.total_amount)}</strong><small>{approved ? 'Approved customer invoice' : 'Internal draft or approval record'}</small></section>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><Banknote size={19} /></span><span>Amount outstanding</span><strong className="num">{money(invoice.balance_due ?? invoice.total_amount)}</strong><small>{paymentStatusLabel(invoice.payment_status)}</small></section>
      <section className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><ShieldCheck size={19} /></span><span>FIRS / MBS readiness</span><StatusBadge label={invoice.firs_compliance_status === 'ready' ? 'Ready locally' : readinessLabel(invoice.firs_compliance_status)} tone={readinessTone(invoice.firs_compliance_status)} /><small>{invoice.firs_compliance_checked_at ? `Checked ${formatDate(invoice.firs_compliance_checked_at)}` : 'No local check run yet'}</small></section>
    </div>

    <div className={styles.twoCol}>
      <DetailCard icon={CalendarDays} title="Document details" description="Saved invoice references and dates.">
        <dl className={styles.details}><DetailRow label="Invoice date" value={formatDate(invoice.invoice_date)} number /><DetailRow label="Due date" value={formatDate(invoice.due_date)} number /><DetailRow label="Currency" value={invoice.currency} number /><DetailRow label="Reference" value={invoice.reference} /><DetailRow label="PO number" value={invoice.purchase_order_number} /><DetailRow label="Subject" value={invoice.subject} /></dl>
      </DetailCard>
      <DetailCard icon={UserRound} title="Customer snapshot" description="Buyer details captured when this invoice was saved.">
        <dl className={styles.details}><DetailRow label="Customer" value={invoice.customer_name_snapshot} /><DetailRow label="Email" value={invoice.customer_email_snapshot} /><DetailRow label="Phone" value={invoice.customer_phone_snapshot} /><DetailRow label="TIN" value={invoice.customer_tin_snapshot} number /><DetailRow label="Billing address" value={invoice.customer_address_snapshot} /></dl>
      </DetailCard>
    </div>

    <DetailCard icon={ReceiptText} title="Invoice breakdown" description="Amounts and classification codes saved on this document.">
      <div className={styles.tableScroll}><table className={styles.linesTable}><thead><tr><th>Description</th><th>Qty / unit</th><th>Unit price</th><th>Discount</th><th>VAT</th><th>Total</th></tr></thead><tbody>
        {(invoice.items || []).length ? invoice.items.map((line, index) => {
          const classification = snapshotClassification(line)
          return <tr key={line.id || index}><td><strong>{line.item_name_snapshot || 'Invoice item'}</strong><small>{line.item_description_snapshot || line.item_code_snapshot || '—'}</small>
            <span className={classification.checked ? styles.classified : styles.unclassified}>{classification.kind}: {classification.code || 'Unclassified'} <em>(saved local snapshot)</em></span></td>
            <td className="num">{Number(line.quantity || 0).toLocaleString('en-NG')} {line.unit_code_snapshot || ''}</td>
            <td className="num">{money(line.unit_price)}</td>
            <td className="num">{money(Number(line.line_discount_amount || 0) + Number(line.invoice_discount_allocated_amount || 0))}</td>
            <td className="num">{money(line.tax_amount)}</td><td className="num"><strong>{money(line.total_amount)}</strong></td></tr>
        }) : <tr><td colSpan="6" className={styles.noLines}>No items have been added to this invoice.</td></tr>}</tbody></table></div>
      <dl className={styles.totals}>
        <DetailRow label="Subtotal" value={money(invoice.subtotal_amount)} number />
        <DetailRow label="Line discounts" value={`− ${money(invoice.line_discount_amount)}`} number />
        <DetailRow label="Invoice discount" value={`− ${money(invoice.invoice_discount_amount)}`} number />
        <DetailRow label="Net amount" value={money(invoice.net_amount)} number />
        <DetailRow label="Tax / VAT" value={money(invoice.tax_amount)} number />
        <div className={styles.grandTotal}><dt>Total</dt><dd className="num">{money(invoice.total_amount)}</dd></div>
      </dl>
    </DetailCard>

    <section className={styles.compliance} aria-label="Local NRS readiness">
      <div className={styles.complianceHead}><div><p className={styles.eyebrow}>FIRS / MBS readiness</p><h2>Prepared for future clearance, not live submission</h2><p>Local checks help find missing fields. No licence, NRS certification or live reporting is implied.</p></div>
        <Button icon={RefreshCw} loading={readinessBusy} disabled={!approved} onClick={prepareReadiness}>Run offline UBL check</Button></div>
      {!approved && <Alert tone="info" title="Approval required">Approve this invoice before running the local readiness check.</Alert>}
      <div className={styles.complianceMeta}>
        <div><span>Transaction model</span><strong>{String(invoice.firs_transaction_type || 'b2b').toUpperCase()}</strong></div>
        <div><span>Document</span><strong>{invoice.firs_document_type === 'simplified_tax_invoice' ? 'Simplified tax invoice' : 'Tax invoice'}</strong></div>
        <div><span>Invoice type</span><strong>{String(invoice.firs_invoice_type_code || 'commercial_invoice').replaceAll('_', ' ')}</strong></div>
        <div><span>Payment means</span><strong>{String(invoice.firs_payment_means_code || 'direct_transfer').replaceAll('_', ' ')}</strong></div>
      </div>
      {(readinessIssues.length > 0 || readinessWarnings.length > 0) && <p className={styles.issueSummary}>{readinessIssues.length} blocking issues · {readinessWarnings.length} warnings in the saved local preflight.</p>}
      {checks.length > 0 && <div className={styles.checks}>{checks.slice(0, 8).map((check, index) => <div key={check.key || index} data-tone={check.status === 'passed' ? 'success' : check.status === 'warning' ? 'warning' : 'danger'}>
        {check.status === 'passed' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<span><strong>{check.label}</strong><small>{check.message}</small></span></div>)}</div>}
      <NrsUblReadinessPanel validation={localReadiness?.ubl_validation || null} />
    </section>

    <NrsQueueStatus invoice={invoice} snapshot={queue} loading={queueBusy} error={queueError} onRetry={() => setQueueRevision((count) => count + 1)} />

    <DetailCard icon={Printer} title="Invoice output" description={approved ? 'Print, download or send the approved invoice.' : 'Preview only: customer-facing output unlocks after approval.'}>
      <div className={styles.outputActions}><Button variant="secondary" icon={Printer} disabled={!approved || !model} onClick={printInvoice}>Print</Button><Button variant="secondary" icon={Download} disabled={!approved || !model} loading={pdfBusy} onClick={downloadPdf}>Download PDF</Button>
        {canSend && <Button icon={Mail} disabled={!approved || !model} onClick={() => { setSendError(''); setSendOpen(true) }}>Send to customer</Button>}
        {canLinks && <Button variant="secondary" icon={Link2} disabled={!approved} onClick={() => setLinkOpen(true)}>Secure link</Button>}
      </div>
      <div className={styles.deliveryStrip}><span><strong className="num">{Number.isFinite(deliveryCount) ? deliveryCount : 0}</strong> email sends</span><span>Last sent: {invoice.last_sent_at ? formatDate(invoice.last_sent_at) : 'Not sent yet'}</span><span>Sent by: {invoice.last_sent_by_name || '—'}</span></div>
      <div className={styles.previewArea} ref={previewRef} aria-label="Invoice document preview">
        {model ? <div className={styles.scaledPreview} style={{ zoom: previewScale }}><DocumentSheet model={model} /></div> : <p className={styles.previewUnavailable}>Document preview unavailable because organisation details were not returned.</p>}
      </div>
    </DetailCard>

    <div className={styles.twoCol}>
      <DetailCard icon={Banknote} title="Payment instructions">
        <dl className={styles.details}><DetailRow label="Bank" value={invoice.bank_name_snapshot} /><DetailRow label="Account name" value={invoice.bank_account_name_snapshot} /><DetailRow label="Account number" value={invoice.bank_account_number_snapshot} number /></dl>
        <p className={styles.textBlock}>{invoice.payment_instructions || 'No payment instruction has been added to this invoice.'}</p>
        {Array.isArray(invoice.payment_allocations) && invoice.payment_allocations.length > 0 && <div className={styles.history}><h3>Allocated payments</h3>{invoice.payment_allocations.map((payment) => <div key={payment.allocation_id}><strong className="num">{money(payment.amount)} · {payment.receipt_number || `Receipt #${payment.payment_id}`}</strong><small>{formatDate(payment.payment_date)} · {payment.payment_method || 'Payment'}</small></div>)}</div>}
      </DetailCard>
      <DetailCard icon={Clock3} title="Workflow history">
        <div className={styles.history}>{Array.isArray(invoice.status_history) && invoice.status_history.length ? invoice.status_history.map((entry, index) => <div key={`${entry.created_at}-${index}`}>
          <strong>{String(entry.action || 'Updated').replaceAll('_', ' ')}</strong>
          <small>{entry.changed_by_name || 'Team member'} · {formatDate(entry.created_at)}</small>
          {entry.reason && <p>{entry.reason}</p>}
        </div>) : <p className={styles.textBlock}>No workflow changes have been recorded.</p>}</div>
      </DetailCard>
    </div>

    {canEdit && editable && <button type="button" className={styles.archive} onClick={() => setConfirmAction('archive')}><Archive size={15} aria-hidden="true" /> Archive this draft invoice</button>}

    <ConfirmDialog open={['submit', 'approve', 'archive'].includes(confirmAction)}
      title={{ submit: 'Submit invoice for approval?', approve: 'Approve invoice?', archive: 'Archive draft invoice?' }[confirmAction]}
      message={{ submit: 'Once submitted, the draft will be locked until it is approved or returned for correction.', approve: 'Approval assigns the official invoice number and activates payment tracking. NRS submission remains pending future integration.', archive: 'This removes the draft from your active workflow. Approved invoices cannot be archived here.' }[confirmAction]}
      confirmLabel={{ submit: 'Submit invoice', approve: 'Approve invoice', archive: 'Archive draft' }[confirmAction]}
      variant={confirmAction === 'archive' ? 'danger' : 'primary'} loading={actionBusy} onConfirm={completeAction} onClose={() => !actionBusy && setConfirmAction('')} />
    <Modal open={confirmAction === 'return'} title="Return invoice for correction?" size="sm" busy={actionBusy}
      description="State what should be corrected before this invoice is resubmitted for approval."
      onClose={() => !actionBusy && setConfirmAction('')}
      footer={<><Button variant="secondary" onClick={() => setConfirmAction('')} disabled={actionBusy}>Cancel</Button><Button variant="danger" loading={actionBusy} onClick={completeAction}>Return invoice</Button></>}>
      <Textarea label="Correction reason" value={returnReason} onChange={(event) => { setReturnReason(event.target.value); setReturnError('') }} error={returnError} rows={4} placeholder="Example: Update the PO number and confirm service quantity." />
    </Modal>
    <SendInvoiceDialog open={sendOpen} invoice={invoice} busy={sendBusy} error={sendError} onClose={() => !sendBusy && setSendOpen(false)} onSend={sendInvoice} />
    {canPay && <InvoicePaymentDialog open={paymentOpen} invoice={invoice} onClose={() => setPaymentOpen(false)} onSaved={(response) => {
      setPaymentOpen(false)
      const receipt = response.data?.data?.payment?.receipt_number
      toast(receipt ? `Payment ${receipt} recorded and allocated.` : 'Payment recorded and allocated successfully.', 'success', 'Payment recorded')
      setRevision((count) => count + 1)
    }} />}
    {canLinks && <InvoiceSecureLinkDialog open={linkOpen} invoice={invoice} onClose={() => setLinkOpen(false)} toast={toast} />}
    {approved && model && createPortal(<div className="di-invoice-print-portal"><DocumentSheet model={model} /></div>, document.body)}
  </div>
}
