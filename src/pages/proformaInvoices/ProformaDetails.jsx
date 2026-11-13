import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import {
  Archive, ArrowLeft, CalendarDays, Download, FileSignature, Info, Link2, Mail,
  PencilLine, Printer, RefreshCw, UserRound, WalletCards,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Skeleton from '../../components/ui/Skeleton'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/overlays/Modal'
import ConfirmDialog from '../../components/overlays/ConfirmDialog'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import DocumentSheet from '../../components/documents/DocumentSheet'
import { DOCUMENT_TYPES } from '../../components/documents/documentModels'
import InvoiceSecureLinkDialog from '../invoices/InvoiceSecureLinkDialog'
import proformaInvoiceService from '../../services/proformaInvoiceService'
import invoiceService from '../../services/invoiceService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import {
  proformaEditable, proformaFilename, proformaIssued, proformaReference,
  proformaStatusLabel, proformaStatusTone, validateProformaEmail,
} from './proformaModel'
import styles from '../invoices/InvoiceDetails.module.css'
import extra from './Proforma.module.css'
import '../invoices/invoicePrint.css'

const MAX_PDF_ATTACHMENT_BYTES = 4 * 1024 * 1024
const deliveryModes = { TEMPLATE: 'template_only', PDF: 'pdf_attachment' }
const absent = (value) => value === undefined || value === null || value === '' ? '—' : value
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the document attachment.'))
  reader.readAsDataURL(blob)
})
const money = (value, currency) => {
  try { return formatCurrency(value, currency || 'NGN') }
  catch { return `${currency || 'NGN'} ${Number(value || 0).toLocaleString('en-NG')}` }
}
function DetailCard({ icon: Icon, title, description, children }) {
  return <section className={styles.card}>
    <div className={styles.cardHeading}><span className={styles.cardIcon}><Icon size={18} aria-hidden="true" /></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
    {children}
  </section>
}
function DetailRow({ label, value, number = false }) {
  return <div className={styles.detailRow}><dt>{label}</dt><dd className={number ? 'num' : undefined}>{absent(value)}</dd></div>
}
function SendProformaDialog({ open, record, busy, error, onClose, onSend }) {
  const [form, setForm] = useState({ recipient_email: '', recipient_name: '', message: '', delivery_mode: deliveryModes.TEMPLATE })
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (!open) return
    setForm({ recipient_email: record?.customer_email_snapshot || '', recipient_name: record?.customer_name_snapshot || '',
      message: '', delivery_mode: deliveryModes.TEMPLATE })
    setErrors({})
  }, [open, record?.id])
  const change = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }
  const send = () => {
    const next = validateProformaEmail(form)
    setErrors(next)
    if (!Object.keys(next).length) onSend(form)
  }
  return <Modal open={open} title="Send proforma invoice" eyebrow="Customer delivery" size="lg" busy={busy}
    description="Choose a branded email template or attach the issued PDF."
    onClose={onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button icon={Mail} loading={busy} onClick={send}>{form.delivery_mode === deliveryModes.PDF ? 'Send with PDF' : 'Send proforma'}</Button></>}>
    <div className={styles.modalFields}>
      {error && <Alert tone="danger" title="Proforma not sent">{error}</Alert>}
      <fieldset className={styles.deliveryModes}><legend>Delivery option</legend>
        <label data-selected={form.delivery_mode === deliveryModes.TEMPLATE}>
          <input type="radio" name="proforma-delivery" checked={form.delivery_mode === deliveryModes.TEMPLATE} onChange={() => change('delivery_mode', deliveryModes.TEMPLATE)} />
          <span><strong>Template only</strong><small>Send a branded proforma email without an attachment.</small></span>
        </label>
        <label data-selected={form.delivery_mode === deliveryModes.PDF}>
          <input type="radio" name="proforma-delivery" checked={form.delivery_mode === deliveryModes.PDF} onChange={() => change('delivery_mode', deliveryModes.PDF)} />
          <span><strong>Attach PDF</strong><small>Include the issued proforma PDF in the email.</small></span>
        </label>
      </fieldset>
      <div className={styles.formGrid}>
        <TextField id="proforma-email" label="Recipient email" type="email" autoComplete="email" value={form.recipient_email} onChange={(event) => change('recipient_email', event.target.value)} error={errors.recipient_email} />
        <TextField id="proforma-recipient" label="Recipient name" maxLength={120} value={form.recipient_name} onChange={(event) => change('recipient_name', event.target.value)} error={errors.recipient_name} />
      </div>
      <Textarea id="proforma-message" label="Optional message" rows={4} maxLength={1200} value={form.message} onChange={(event) => change('message', event.target.value)} error={errors.message} />
    </div>
  </Modal>
}

export default function ProformaDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToastStore((state) => state.showToast)
  const permissions = useAuthStore((state) => state.permissions)
  const canEdit = hasPermission(permissions, 'proformas.edit')
  const canSend = hasPermission(permissions, 'proformas.send')
  const canShare = hasPermission(permissions, 'portal_links.manage')
  const [record, setRecord] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(820)
  const previewRef = useRef(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRecord(null)
    setOrganization(null)
    setHistory([])
    setLogoDataUrl('')
    const load = async () => {
      try {
        const response = await proformaInvoiceService.document(id)
        const data = response.data?.data || {}
        if (!data.proforma) throw new Error('The proforma document was not returned by the server.')
        if (!active) return
        setRecord(data.proforma)
        setOrganization(data.organization || null)
        setHistory(Array.isArray(data.delivery_history) ? data.delivery_history : [])
        if (data.organization?.logo_available) {
          try {
            const image = await invoiceService.organizationLogo()
            const encoded = await blobToDataUrl(image.data)
            if (active) setLogoDataUrl(encoded)
          } catch { if (active) setLogoDataUrl('') }
        }
      } catch (requestError) { if (active) setError(getErrorMessage(requestError, 'Unable to load this proforma.')) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id, revision])

  useEffect(() => {
    const target = previewRef.current
    if (!target) return undefined
    const measure = () => setPreviewWidth(target.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(target)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [loading])

  const model = useMemo(() => record && organization ? DOCUMENT_TYPES.proforma.build(record, organization, logoDataUrl) : null,
    [record, organization, logoDataUrl])
  const scale = Math.max(0.1, Math.min(1, (previewWidth - 4) / 820))
  const issued = proformaIssued(record)
  const editable = proformaEditable(record)
  const ref = proformaReference(record)
  const pdfBlob = async () => {
    if (!issued || !model) throw new Error('Issue this proforma before creating a customer PDF.')
    const { renderDocumentPdf } = await import('../../components/documents/pdf')
    return renderDocumentPdf(model)
  }
  const download = async () => {
    if (pdfBusy || !issued) return
    setPdfBusy(true)
    try {
      saveAs(await pdfBlob(), `${proformaFilename(record)}.pdf`)
      toast('Proforma PDF generated successfully.', 'success', 'PDF ready')
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate the PDF.'), 'error', 'PDF failed') }
    finally { setPdfBusy(false) }
  }
  const send = async (form) => {
    if (!issued || sendBusy || !canSend) return
    setSendBusy(true)
    setSendError('')
    try {
      let pdf_attachment = null
      if (form.delivery_mode === deliveryModes.PDF) {
        const blob = await pdfBlob()
        if (blob.size > MAX_PDF_ATTACHMENT_BYTES) throw new Error('The generated PDF exceeds the 4 MB email limit. Try template-only delivery.')
        const encoded = await blobToDataUrl(blob)
        pdf_attachment = { filename: `${proformaFilename(record)}.pdf`, mime_type: 'application/pdf',
          content_base64: encoded.split(',')[1], size_bytes: blob.size }
      }
      const response = await proformaInvoiceService.sendToCustomer({
        id: record.id, recipient_email: form.recipient_email.trim(), recipient_name: form.recipient_name.trim(),
        message: form.message.trim(), delivery_mode: form.delivery_mode, pdf_attachment,
      })
      setSendOpen(false)
      toast(response.data?.message || 'Proforma sent successfully.', 'success', 'Sent to customer')
      setRevision((value) => value + 1)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send the proforma.')) }
    finally { setSendBusy(false) }
  }
  const archive = async () => {
    if (!canEdit || !editable || archiveBusy) return
    setArchiveBusy(true)
    try {
      await proformaInvoiceService.archive(record.id)
      toast('Proforma draft archived successfully.', 'success', 'Draft archived')
      navigate('/app/proforma-invoices', { replace: true })
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to archive the draft.'), 'error', 'Archive failed') }
    finally { setArchiveBusy(false); setArchiveOpen(false) }
  }

  if (loading) return <div className={styles.page} aria-busy="true" aria-label="Loading proforma details"><Skeleton height="110px" /><Skeleton height="125px" /><Skeleton height="300px" /></div>
  if (error || !record) return <div className={styles.unavailable} role="alert"><FileSignature size={30} /><h1>Proforma unavailable</h1><p>{error || 'This proforma could not be found.'}</p>
    <div className={styles.actions}><Button onClick={() => setRevision((value) => value + 1)}>Try again</Button><Button variant="secondary" to="/app/proforma-invoices">Return to proformas</Button></div></div>
  const sentCount = Number(record.sent_count ?? history.length) || 0

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link className={styles.back} to="/app/proforma-invoices"><ArrowLeft size={15} /> Proforma Invoices</Link>
      <div className={styles.actions}><Button icon={RefreshCw} variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}>Refresh</Button>
        {canEdit && editable && <Button icon={PencilLine} to={`/app/proforma-invoices/${record.id}/edit`} size="sm">Edit draft</Button>}</div>
    </div>
    <section className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.heroIcon}><FileSignature size={24} aria-hidden="true" /></span>
        <div className={styles.heroText}><span className={styles.eyebrow}>Proforma invoice</span><h1 className="num ref">{ref}</h1>
          <p>{record.customer_name_snapshot || 'Customer'} · {formatDate(record.issue_date)} – {formatDate(record.expiry_date)}</p></div>
        <div className={styles.badges}><StatusBadge status={record.status} tone={proformaStatusTone(record.status)} label={proformaStatusLabel(record.status)} /></div>
      </div>
      <p className={extra.note}><Info size={16} aria-hidden="true" /> Proforma invoices are commercial proposals, not tax invoices or NRS submissions. No official NRS clearance or IRN applies to this document.</p>
    </section>
    <div className={styles.summaryGrid}>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><WalletCards size={19} /></span><span>Total proposed value</span><strong className="num">{money(record.total_amount, record.currency)}</strong><small>{record.currency || 'NGN'}</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><CalendarDays size={19} /></span><span>Issue date</span><strong className="num">{formatDate(record.issue_date)}</strong><small>{record.proforma_number ? 'Assigned on issue' : 'Draft date'}</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><CalendarDays size={19} /></span><span>Valid until</span><strong className="num">{formatDate(record.expiry_date)}</strong><small>{record.expiry_date < new Date().toISOString().slice(0, 10) ? 'Validity date passed' : 'Validity period'}</small></div>
    </div>
    <div className={styles.twoCol}>
      <DetailCard icon={UserRound} title="Customer and proposal details">
        <dl className={styles.details}><DetailRow label="Customer" value={record.customer_name_snapshot} /><DetailRow label="Contact email" value={record.customer_email_snapshot} />
          <DetailRow label="Reference" value={record.reference} number /><DetailRow label="Subject" value={record.subject} />
          <DetailRow label="Currency" value={record.currency} number /><DetailRow label="Proposed lines" value={record.items?.length} number /></dl>
      </DetailCard>
      <DetailCard icon={WalletCards} title="Financial summary">
        <dl className={styles.details}><DetailRow label="Subtotal" value={money(record.subtotal_amount, record.currency)} number />
          <DetailRow label="Line discounts" value={money(record.line_discount_amount, record.currency)} number />
          <DetailRow label="Overall discount" value={money(record.proforma_discount_amount, record.currency)} number />
          <DetailRow label="Net amount" value={money(record.net_amount, record.currency)} number />
          <DetailRow label="Tax" value={money(record.tax_amount, record.currency)} number />
          <DetailRow label="Total" value={money(record.total_amount, record.currency)} number /></dl>
      </DetailCard>
    </div>
    <DetailCard icon={Printer} title="Proforma document" description={issued ? 'Print, download, send or share this issued proforma.' : 'Draft preview only. Issue the proforma to enable customer-facing output.'}>
      <div className={styles.outputActions}>
        <Button variant="secondary" icon={Printer} disabled={!issued || !model} onClick={() => window.print()}>Print</Button>
        <Button variant="secondary" icon={Download} disabled={!issued || !model} loading={pdfBusy} onClick={download}>Download PDF</Button>
        {canSend && <Button icon={Mail} disabled={!issued || !model} onClick={() => { setSendError(''); setSendOpen(true) }}>Send to customer</Button>}
        {canShare && <Button variant="secondary" icon={Link2} disabled={!issued} onClick={() => setLinkOpen(true)}>Secure link</Button>}
      </div>
      <div className={styles.deliveryStrip}><span><strong className="num">{sentCount}</strong> email send{sentCount === 1 ? '' : 's'}</span>
        <span>Last sent: {record.last_sent_at ? formatDate(record.last_sent_at) : 'Not sent yet'}</span>
        <span>Sent by: {record.last_sent_by_name || '—'}</span></div>
      <div className={styles.previewArea} ref={previewRef} aria-label="Proforma document preview">
        {model ? <div className={styles.scaledPreview} style={{ zoom: scale }}><DocumentSheet model={model} /></div>
          : <p className={styles.previewUnavailable}>Organisation document details are unavailable.</p>}
      </div>
    </DetailCard>
    <div className={styles.twoCol}>
      <DetailCard icon={CalendarDays} title="Notes and payment details">
        <dl className={styles.details}><DetailRow label="Payment bank" value={record.bank_name_snapshot} />
          <DetailRow label="Account name" value={record.bank_account_name_snapshot} />
          <DetailRow label="Account number" value={record.bank_account_number_snapshot} number /></dl>
        <p className={styles.textBlock}>{record.notes || record.terms_and_conditions || 'No additional terms supplied.'}</p>
      </DetailCard>
      <DetailCard icon={Mail} title="Delivery history">
        {history.length ? <div className={styles.history}>{history.map((entry) => <div key={entry.id}>
          <strong>{entry.recipient_name || entry.recipient_email || 'Customer'}</strong>
          <small>{entry.recipient_email} · {formatDate(entry.sent_at || entry.created_at)} · {entry.attached_pdf ? 'PDF attached' : 'Template only'}</small>
          <small>{entry.delivery_status || 'Sent'}</small>
        </div>)}</div> : <p className={styles.textBlock}>This proforma has not been sent by email yet.</p>}
      </DetailCard>
    </div>
    {canEdit && editable && <button type="button" className={styles.archive} onClick={() => setArchiveOpen(true)}><Archive size={16} /> Archive draft proforma</button>}
    <ConfirmDialog open={archiveOpen} title="Archive this proforma draft?" message="Archived proforma drafts are removed from your active documents. Issued proformas cannot be archived."
      variant="danger" confirmLabel="Archive draft" loading={archiveBusy} onConfirm={archive} onClose={() => !archiveBusy && setArchiveOpen(false)} />
    {canSend && <SendProformaDialog open={sendOpen} record={record} busy={sendBusy} error={sendError}
      onClose={() => !sendBusy && setSendOpen(false)} onSend={send} />}
    {canShare && <InvoiceSecureLinkDialog open={linkOpen} document={record} documentType="proforma_invoice" toast={toast} onClose={() => setLinkOpen(false)} />}
    {issued && model && createPortal(<div className="di-invoice-print-portal"><DocumentSheet model={model} /></div>, document.body)}
  </div>
}
