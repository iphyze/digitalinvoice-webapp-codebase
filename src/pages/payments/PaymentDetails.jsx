import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { ArrowLeft, Banknote, CalendarDays, Download, FileCheck2, Info, Link2, Mail, Printer, RefreshCw, RotateCcw, ShieldAlert, WalletCards } from 'lucide-react'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Skeleton from '../../components/ui/Skeleton'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/overlays/Modal'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import DocumentSheet from '../../components/documents/DocumentSheet'
import { DOCUMENT_TYPES } from '../../components/documents/documentModels'
import InvoiceSecureLinkDialog from '../invoices/InvoiceSecureLinkDialog'
import paymentService from '../../services/paymentService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { paymentCanAllocate, paymentMethodText, paymentMoney, paymentReference, paymentStatusLabel, paymentStatusTone, safePaymentFilename, validatePaymentEmail } from './paymentModel'
import PaymentAllocateDialog from './PaymentAllocateDialog'
import styles from '../invoices/InvoiceDetails.module.css'
import extra from './Payments.module.css'
import '../invoices/invoicePrint.css'

const MAX_PDF_BYTES = 4 * 1024 * 1024
const ABSENT = (value) => value === undefined || value === null || value === '' ? '—' : value
const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the receipt PDF or logo.'))
  reader.readAsDataURL(blob)
})
function DetailCard({ icon: Icon, title, description, children }) {
  return <section className={styles.card}>
    <div className={styles.cardHeading}><span className={styles.cardIcon}><Icon size={18} aria-hidden="true" /></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
    {children}
  </section>
}
function DetailRow({ label, value, numeric = false }) {
  return <div className={styles.detailRow}><dt>{label}</dt><dd className={numeric ? 'num' : undefined}>{ABSENT(value)}</dd></div>
}
function ReceiptEmailDialog({ open, payment, busy, error, onClose, onSend }) {
  const [form, setForm] = useState({ recipient_email: '', recipient_name: '', message: '', delivery_mode: 'template_only' })
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (!open) return
    setForm({ recipient_email: payment?.customer_email_snapshot || '', recipient_name: payment?.customer_name_snapshot || '', message: '', delivery_mode: 'template_only' })
    setErrors({})
  }, [open, payment?.id])
  const change = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })) }
  const submit = () => {
    const next = validatePaymentEmail(form)
    setErrors(next)
    if (!Object.keys(next).length) onSend(form)
  }
  return <Modal open={open} title="Send payment receipt" eyebrow="Customer delivery" size="lg" busy={busy}
    description="Send the branded receipt email, with an optional PDF attachment." onClose={onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button icon={Mail} loading={busy} onClick={submit}>{form.delivery_mode === 'pdf_attachment' ? 'Send with PDF' : 'Send receipt'}</Button></>}>
    <div className={extra.form}>
      {error && <Alert tone="danger" title="Receipt not sent">{error}</Alert>}
      <fieldset className={extra.deliveryModes}><legend>Delivery option</legend>
        <label data-selected={form.delivery_mode === 'template_only'}><input name="receipt_delivery_mode" type="radio" checked={form.delivery_mode === 'template_only'} onChange={() => change('delivery_mode', 'template_only')} /><span><strong>Template only</strong><small>Send a branded email without an attachment.</small></span></label>
        <label data-selected={form.delivery_mode === 'pdf_attachment'}><input name="receipt_delivery_mode" type="radio" checked={form.delivery_mode === 'pdf_attachment'} onChange={() => change('delivery_mode', 'pdf_attachment')} /><span><strong>Attach PDF</strong><small>Include the generated payment receipt PDF.</small></span></label>
      </fieldset>
      <div className={extra.formGrid}>
        <TextField label="Recipient email" type="email" value={form.recipient_email} onChange={(event) => change('recipient_email', event.target.value)} error={errors.recipient_email} autoComplete="email" />
        <TextField label="Recipient name" value={form.recipient_name} onChange={(event) => change('recipient_name', event.target.value)} maxLength={120} error={errors.recipient_name} />
      </div>
      <Textarea label="Message (optional)" rows={3} value={form.message} maxLength={1200} onChange={(event) => change('message', event.target.value)} error={errors.message} />
    </div>
  </Modal>
}
function VoidPaymentDialog({ open, payment, busy, error, onClose, onVoid }) {
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')
  useEffect(() => { if (open) { setReason(''); setValidationError('') } }, [open, payment?.id])
  const submit = () => {
    if (!reason.trim()) { setValidationError('Provide a reason for voiding the payment.'); return }
    onVoid(reason.trim())
  }
  return <Modal open={open} title="Void this payment?" eyebrow="Reverse receipt" size="md" busy={busy}
    description="Voiding a receipt reverses all its active invoice allocations and updates the affected invoice balances. This cannot be undone." onClose={onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" icon={RotateCcw} loading={busy} onClick={submit}>Void payment</Button></>}>
    <div className={extra.form}>
      {error && <Alert tone="danger" title="Payment not voided">{error}</Alert>}
      <Alert tone="warning" title="This action affects invoice balances">The payment will be marked as void, and any allocations made from it will be reversed.</Alert>
      <Textarea label="Reason for voiding" value={reason} onChange={(event) => { setReason(event.target.value); setValidationError('') }} rows={3} maxLength={500} error={validationError} />
    </div>
  </Modal>
}

export default function PaymentDetails() {
  const { id } = useParams()
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canAllocate = hasPermission(permissions, 'payments.record')
  const canViewInvoices = hasPermission(permissions, 'invoices.view')
  const canVoid = hasPermission(permissions, 'payments.void')
  const canSend = hasPermission(permissions, 'payments.send')
  const canShare = hasPermission(permissions, 'portal_links.manage')
  const [record, setRecord] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [history, setHistory] = useState([])
  const [logo, setLogo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidBusy, setVoidBusy] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(820)
  const previewRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRecord(null)
    setOrganization(null)
    setHistory([])
    setLogo('')
    const load = async () => {
      try {
        const response = await paymentService.document(id)
        const data = response.data?.data || {}
        if (!active) return
        if (!data.payment?.id) throw new Error('Payment details were not returned by the server.')
        setRecord(data.payment)
        setOrganization(data.organization || null)
        setHistory(Array.isArray(data.delivery_history) ? data.delivery_history : [])
        if (data.organization?.logo_available) {
          try {
            const imageResponse = await paymentService.organizationLogo()
            const uri = await toDataUrl(imageResponse.data)
            if (active) setLogo(uri)
          } catch { if (active) setLogo('') }
        }
      } catch (requestError) { if (active) setError(getErrorMessage(requestError, 'Unable to retrieve this payment.')) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id, revision])
  useEffect(() => {
    const element = previewRef.current
    if (!element) return undefined
    const update = () => setPreviewWidth(element.getBoundingClientRect().width)
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [loading])

  const model = useMemo(() => record && organization ? DOCUMENT_TYPES.payment_receipt.build(record, organization, logo) : null, [record, organization, logo])
  const active = record?.status !== 'void'
  const previewScale = Math.max(0.1, Math.min(1, (previewWidth - 4) / 820))
  const allocations = Array.isArray(record?.allocations) ? record.allocations : []
  const activeAllocations = allocations.filter((row) => !row.reversed_at)
  const pdfBlob = async () => {
    if (!model) throw new Error('Receipt document details are unavailable. Refresh and try again.')
    const { renderDocumentPdf } = await import('../../components/documents/pdf')
    return renderDocumentPdf(model)
  }
  const download = async () => {
    if (!active || !model || pdfBusy) return
    setPdfBusy(true)
    try { saveAs(await pdfBlob(), `${safePaymentFilename(record)}.pdf`); toast('Payment receipt PDF generated.', 'success', 'PDF ready') }
    catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate receipt PDF.'), 'error', 'PDF not generated') }
    finally { setPdfBusy(false) }
  }
  const send = async (form) => {
    if (!canSend || !active || sendBusy) return
    setSendBusy(true)
    setSendError('')
    try {
      let pdf_attachment
      if (form.delivery_mode === 'pdf_attachment') {
        const blob = await pdfBlob()
        if (blob.size > MAX_PDF_BYTES) throw new Error('Receipt PDF is over 4 MB. Choose template-only delivery instead.')
        pdf_attachment = { mime_type: 'application/pdf', filename: `${safePaymentFilename(record)}.pdf`, content_base64: (await toDataUrl(blob)).split(',')[1] }
      }
      const result = await paymentService.sendToCustomer({ id: record.id, recipient_email: form.recipient_email.trim(), recipient_name: form.recipient_name.trim(),
        message: form.message.trim(), delivery_mode: form.delivery_mode, ...(pdf_attachment ? { pdf_attachment } : {}) })
      setSendOpen(false)
      toast(result.data?.message || 'Receipt sent to customer successfully.', 'success', 'Receipt sent')
      setRevision((value) => value + 1)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send payment receipt.')) }
    finally { setSendBusy(false) }
  }
  const voidPayment = async (reason) => {
    if (!canVoid || !active || voidBusy) return
    setVoidBusy(true)
    setVoidError('')
    try {
      const response = await paymentService.void({ id: Number(record.id), reason })
      setVoidOpen(false)
      toast(response.data?.message || 'Payment voided and allocations reversed.', 'success', 'Payment voided')
      setRevision((value) => value + 1)
    } catch (requestError) { setVoidError(getErrorMessage(requestError, 'Unable to void this payment.')) }
    finally { setVoidBusy(false) }
  }
  if (loading) return <div className={styles.page} aria-busy="true" aria-label="Loading payment details"><Skeleton height="110px" /><Skeleton height="125px" /><Skeleton height="300px" /></div>
  if (error || !record) return <div className={styles.unavailable} role="alert"><WalletCards size={30} /><h1>Payment unavailable</h1>
    <p>{error || 'This payment could not be found.'}</p><div className={styles.actions}><Button onClick={() => setRevision((value) => value + 1)}>Try again</Button><Button variant="secondary" to="/app/payments">Back to payments</Button></div></div>

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link className={styles.back} to="/app/payments"><ArrowLeft size={15} /> Payments</Link>
      <div className={styles.actions}><Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => setRevision((value) => value + 1)}>Refresh</Button>
        {canAllocate && paymentCanAllocate(record) && <Button icon={WalletCards} size="sm" onClick={() => setAllocateOpen(true)}>Allocate payment</Button>}</div>
    </div>
    <section className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.heroIcon}><Banknote size={24} aria-hidden="true" /></span>
        <div className={styles.heroText}><span className={styles.eyebrow}>Customer payment</span><h1 className="num ref">{paymentReference(record)}</h1>
          <p>{record.customer_name_snapshot || 'Customer'} · {formatDate(record.payment_date)}</p></div>
        <div className={styles.badges}><StatusBadge status={record.status} label={paymentStatusLabel(record.status)} tone={paymentStatusTone(record.status)} /></div>
      </div>
      {record.status === 'void' && <Alert tone="warning" title="Voided payment">This receipt has been voided. Its invoice allocations were reversed. Customer delivery is disabled.</Alert>}
    </section>
    <div className={styles.summaryGrid}>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><WalletCards size={19} /></span><span>Amount received</span><strong className="num">{paymentMoney(record.amount, record.currency)}</strong><small>{paymentMethodText(record)}</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><FileCheck2 size={19} /></span><span>Allocated to invoices</span><strong className="num">{paymentMoney(record.allocated_amount, record.currency)}</strong><small>{activeAllocations.length} active invoice allocation{activeAllocations.length === 1 ? '' : 's'}</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><Banknote size={19} /></span><span>Unallocated amount</span><strong className="num">{paymentMoney(record.unallocated_amount, record.currency)}</strong><small>{active ? 'Available for eligible invoices' : 'Voided receipt'}</small></div>
    </div>
    <div className={styles.twoCol}>
      <DetailCard icon={WalletCards} title="Payment information"><dl className={styles.details}>
        <DetailRow label="Customer" value={record.customer_name_snapshot} /><DetailRow label="Customer email" value={record.customer_email_snapshot} />
        <DetailRow label="Payment date" value={formatDate(record.payment_date)} numeric /><DetailRow label="Currency" value={record.currency} numeric />
        <DetailRow label="Payment method" value={paymentMethodText(record)} /><DetailRow label="Reference" value={record.reference} numeric />
        <DetailRow label="Payer name" value={record.payer_name} /><DetailRow label="Recorded by" value={record.created_by_name} />
        <DetailRow label="Recorded at" value={record.created_at ? formatDate(record.created_at) : null} numeric />
      </dl></DetailCard>
      <DetailCard icon={FileCheck2} title="Settlement and bank account"><dl className={styles.details}>
        <DetailRow label="Receipt status" value={paymentStatusLabel(record.status)} />
        <DetailRow label="Payment bank" value={record.bank_name_snapshot} /><DetailRow label="Account name" value={record.bank_account_name_snapshot} />
        <DetailRow label="Account number" value={record.bank_account_number_snapshot} numeric />
        <DetailRow label="Last emailed" value={record.last_sent_at ? formatDate(record.last_sent_at) : 'Not yet sent'} />
        <DetailRow label="Times sent" value={Number(record.sent_count || 0)} numeric />
        {record.status === 'void' && <><DetailRow label="Voided at" value={formatDate(record.voided_at)} /><DetailRow label="Voided by" value={record.voided_by_name} /><DetailRow label="Reason" value={record.void_reason} /></>}
      </dl></DetailCard>
    </div>
    <DetailCard icon={WalletCards} title="Invoice allocations" description="Only active allocations affect invoice settlement; reversed items are preserved for audit history.">
      {allocations.length ? <div className={extra.allocationHistory}>
        {allocations.map((allocation) => <article className={extra.historyRow} key={allocation.id} data-reversed={Boolean(allocation.reversed_at)}>
          <div>{canViewInvoices ? <Link to={`/app/invoices/${allocation.invoice_id}`} className="num ref">{allocation.invoice_number || `Invoice #${allocation.invoice_id}`}</Link> : <strong className="num ref">{allocation.invoice_number || `Invoice #${allocation.invoice_id}`}</strong>}
            <small>Allocated {formatDate(allocation.allocated_at)}{allocation.allocated_by_name ? ` · ${allocation.allocated_by_name}` : ''}</small>
            {allocation.reversed_at && <small>Reversed {formatDate(allocation.reversed_at)}{allocation.reversal_reason ? ` · ${allocation.reversal_reason}` : ''}</small>}</div>
          <div className={extra.historyValue}><strong className="num">{paymentMoney(allocation.amount, record.currency)}</strong>{allocation.reversed_at && <StatusBadge status="void" label="Reversed" tone="danger" />}</div>
        </article>)}
      </div> : <div className={extra.emptyNote}><p>No invoice allocations yet. You can allocate this receipt to eligible approved invoices.</p>
        {canAllocate && paymentCanAllocate(record) && <Button size="sm" icon={WalletCards} onClick={() => setAllocateOpen(true)}>Allocate payment</Button>}</div>}
    </DetailCard>
    <DetailCard icon={Printer} title="Payment receipt" description={active ? 'Preview, print, download and share the receipt.' : 'This receipt is void; it is retained here for audit only.'}>
      <div className={styles.outputActions}>
        <Button variant="secondary" icon={Printer} disabled={!active || !model} onClick={() => window.print()}>Print</Button>
        <Button variant="secondary" icon={Download} disabled={!active || !model} loading={pdfBusy} onClick={download}>Download PDF</Button>
        {canSend && <Button icon={Mail} disabled={!active || !model} onClick={() => { setSendError(''); setSendOpen(true) }}>Send to customer</Button>}
        {canShare && <Button variant="secondary" icon={Link2} disabled={!active} onClick={() => setLinkOpen(true)}>Secure link</Button>}
      </div>
      <p className={extra.note}><Info size={16} aria-hidden="true" /> Official NRS evidence appears only when independently verified production evidence exists. Payment recording alone does not mean NRS clearance.</p>
      <div className={styles.previewArea} ref={previewRef} aria-label="Payment receipt document preview">
        {model ? <div className={styles.scaledPreview} style={{ zoom: previewScale }}><DocumentSheet model={model} /></div>
          : <p className={styles.previewUnavailable}>Organisation document details are unavailable.</p>}
      </div>
    </DetailCard>
    <DetailCard icon={CalendarDays} title="Receipt delivery history">
      {history.length ? <div className={styles.history}>{history.map((entry) => <div key={entry.id}>
        <strong>{entry.recipient_name || entry.recipient_email || 'Customer'}</strong>
        <small>{entry.recipient_email || '—'} · {formatDate(entry.sent_at || entry.created_at)} · {entry.delivery_status || 'Sent'}</small>
        {entry.sent_by_name && <small>Sent by {entry.sent_by_name}</small>}
      </div>)}</div> : <p className={styles.textBlock}>This receipt has not been sent by email yet.</p>}
    </DetailCard>
    {record.notes && <DetailCard icon={Info} title="Payment notes"><p className={styles.textBlock}>{record.notes}</p></DetailCard>}
    {canVoid && active && <button type="button" className={styles.archive} onClick={() => { setVoidError(''); setVoidOpen(true) }}><ShieldAlert size={16} /> Void payment and reverse allocations</button>}
    {canAllocate && <PaymentAllocateDialog open={allocateOpen} payment={record} onClose={() => setAllocateOpen(false)} onSaved={() => {
      setAllocateOpen(false)
      toast('Payment allocated successfully.', 'success', 'Invoices updated')
      setRevision((value) => value + 1)
    }} />}
    {canVoid && <VoidPaymentDialog open={voidOpen} payment={record} busy={voidBusy} error={voidError} onClose={() => !voidBusy && setVoidOpen(false)} onVoid={voidPayment} />}
    {canSend && <ReceiptEmailDialog open={sendOpen} payment={record} busy={sendBusy} error={sendError} onClose={() => !sendBusy && setSendOpen(false)} onSend={send} />}
    {canShare && <InvoiceSecureLinkDialog open={linkOpen} document={record} documentType="payment_receipt" toast={toast} onClose={() => setLinkOpen(false)} />}
    {active && model && createPortal(<div className="di-invoice-print-portal"><DocumentSheet model={model} /></div>, document.body)}
  </div>
}
