import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { Archive, ArrowLeft, CalendarDays, Download, Info, Link2, Mail, MapPin, PackageCheck, PencilLine, Printer, RefreshCw, Truck, UserRound } from 'lucide-react'
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
import deliveryNoteService from '../../services/deliveryNoteService'
import invoiceService from '../../services/invoiceService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import {
  deliveryEditable, deliveryFilename, deliveryIssued, deliveryReference,
  deliveryStatusLabel, deliveryStatusTone, validateDeliveryEmail,
} from './deliveryNoteModel'
import styles from '../invoices/InvoiceDetails.module.css'
import extra from './DeliveryNotes.module.css'
import '../invoices/invoicePrint.css'

const MAX_PDF_BYTES = 4 * 1024 * 1024
const MODES = { TEMPLATE: 'template_only', PDF: 'pdf_attachment' }
const absent = (value) => value === undefined || value === null || value === '' ? '—' : value
const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the PDF or organisation logo.'))
  reader.readAsDataURL(blob)
})

function DetailCard({ icon: Icon, title, description, children }) {
  return <section className={styles.card}>
    <div className={styles.cardHeading}><span className={styles.cardIcon}><Icon size={18} aria-hidden="true" /></span>
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
    {children}
  </section>
}
function DetailRow({ label, value, number = false }) {
  return <div className={styles.detailRow}><dt>{label}</dt><dd className={number ? 'num' : undefined}>{absent(value)}</dd></div>
}
function SendDeliveryDialog({ open, record, busy, error, onClose, onSend }) {
  const [form, setForm] = useState({ recipient_email: '', recipient_name: '', message: '', delivery_mode: MODES.TEMPLATE })
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (!open) return
    setForm({ recipient_email: record?.customer_email_snapshot || '', recipient_name: record?.customer_name_snapshot || '',
      message: '', delivery_mode: MODES.TEMPLATE })
    setErrors({})
  }, [open, record?.id])
  const update = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })) }
  const submit = () => {
    const next = validateDeliveryEmail(form)
    setErrors(next)
    if (!Object.keys(next).length) onSend(form)
  }
  return <Modal open={open} title="Send delivery note" eyebrow="Customer delivery" size="lg" busy={busy}
    description="Use a branded email template or attach the issued delivery note PDF." onClose={onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button icon={Mail} loading={busy} onClick={submit}>
      {form.delivery_mode === MODES.PDF ? 'Send with PDF' : 'Send delivery note'}</Button></>}>
    <div className={styles.modalFields}>
      {error && <Alert tone="danger" title="Delivery note not sent">{error}</Alert>}
      <fieldset className={styles.deliveryModes}><legend>Delivery option</legend>
        <label data-selected={form.delivery_mode === MODES.TEMPLATE}><input type="radio" name="delivery-mode" checked={form.delivery_mode === MODES.TEMPLATE}
          onChange={() => update('delivery_mode', MODES.TEMPLATE)} /><span><strong>Template only</strong><small>Email the delivery note without a PDF attachment.</small></span></label>
        <label data-selected={form.delivery_mode === MODES.PDF}><input type="radio" name="delivery-mode" checked={form.delivery_mode === MODES.PDF}
          onChange={() => update('delivery_mode', MODES.PDF)} /><span><strong>Attach PDF</strong><small>Include the issued delivery note PDF.</small></span></label>
      </fieldset>
      <div className={styles.formGrid}>
        <TextField id="delivery-email" label="Recipient email" type="email" autoComplete="email" value={form.recipient_email}
          onChange={(event) => update('recipient_email', event.target.value)} error={errors.recipient_email} />
        <TextField id="delivery-recipient" label="Recipient name" maxLength={120} value={form.recipient_name}
          onChange={(event) => update('recipient_name', event.target.value)} error={errors.recipient_name} />
      </div>
      <Textarea id="delivery-message" label="Optional message" rows={4} maxLength={1200} value={form.message}
        onChange={(event) => update('message', event.target.value)} error={errors.message} />
    </div>
  </Modal>
}

export default function DeliveryNoteDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToastStore((state) => state.showToast)
  const permissions = useAuthStore((state) => state.permissions)
  const canEdit = hasPermission(permissions, 'delivery_notes.edit')
  const canViewInvoices = hasPermission(permissions, 'invoices.view')
  const canSend = hasPermission(permissions, 'delivery_notes.send')
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
    setLoading(true); setError(''); setRecord(null); setOrganization(null); setLogoDataUrl(''); setHistory([])
    const load = async () => {
      try {
        const response = await deliveryNoteService.document(id)
        const data = response.data?.data || {}
        if (!data.delivery_note) throw new Error('Delivery note document was not returned by the server.')
        if (!active) return
        setRecord(data.delivery_note)
        setOrganization(data.organization || null)
        setHistory(Array.isArray(data.delivery_history) ? data.delivery_history : [])
        if (data.organization?.logo_available) {
          try {
            const image = await invoiceService.organizationLogo()
            const encoded = await toDataUrl(image.data)
            if (active) setLogoDataUrl(encoded)
          } catch { if (active) setLogoDataUrl('') }
        }
      } catch (requestError) { if (active) setError(getErrorMessage(requestError, 'Unable to load this delivery note.')) }
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

  const model = useMemo(() => record && organization ? DOCUMENT_TYPES.delivery_note.build(record, organization, logoDataUrl) : null,
    [record, organization, logoDataUrl])
  const issued = deliveryIssued(record)
  const editable = deliveryEditable(record)
  const previewScale = Math.max(0.1, Math.min(1, (previewWidth - 4) / 820))
  const pdfBlob = async () => {
    if (!issued || !model) throw new Error('Issue this delivery note before exporting a customer PDF.')
    const { renderDocumentPdf } = await import('../../components/documents/pdf')
    return renderDocumentPdf(model)
  }
  const download = async () => {
    if (!issued || pdfBusy) return
    setPdfBusy(true)
    try {
      saveAs(await pdfBlob(), `${deliveryFilename(record)}.pdf`)
      toast('Delivery note PDF generated successfully.', 'success', 'PDF ready')
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate the PDF.'), 'error', 'PDF failed') }
    finally { setPdfBusy(false) }
  }
  const send = async (form) => {
    if (!issued || !canSend || sendBusy) return
    setSendBusy(true)
    setSendError('')
    try {
      let pdf_attachment = null
      if (form.delivery_mode === MODES.PDF) {
        const blob = await pdfBlob()
        if (blob.size > MAX_PDF_BYTES) throw new Error('The PDF exceeds the 4 MB email limit. Choose template-only delivery.')
        const dataUrl = await toDataUrl(blob)
        pdf_attachment = { filename: `${deliveryFilename(record)}.pdf`, mime_type: 'application/pdf',
          content_base64: dataUrl.split(',')[1], size_bytes: blob.size }
      }
      const response = await deliveryNoteService.sendToCustomer({
        id: record.id,
        recipient_email: form.recipient_email.trim(), recipient_name: form.recipient_name.trim(),
        message: form.message.trim(), delivery_mode: form.delivery_mode, pdf_attachment,
      })
      setSendOpen(false)
      toast(response.data?.message || 'Delivery note sent successfully.', 'success', 'Sent to customer')
      setRevision((value) => value + 1)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send this delivery note.')) }
    finally { setSendBusy(false) }
  }
  const archive = async () => {
    if (!canEdit || !editable || archiveBusy) return
    setArchiveBusy(true)
    try {
      await deliveryNoteService.archive(record.id)
      toast('Delivery note draft archived successfully.', 'success', 'Draft archived')
      navigate('/app/delivery-notes', { replace: true })
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to archive this draft.'), 'error', 'Archive failed') }
    finally { setArchiveBusy(false); setArchiveOpen(false) }
  }

  if (loading) return <div className={styles.page} aria-busy="true" aria-label="Loading delivery note details">
    <Skeleton height="110px" /><Skeleton height="125px" /><Skeleton height="300px" /></div>
  if (error || !record) return <div className={styles.unavailable} role="alert"><Truck size={30} /><h1>Delivery note unavailable</h1>
    <p>{error || 'This delivery note could not be found.'}</p><div className={styles.actions}>
      <Button onClick={() => setRevision((value) => value + 1)}>Try again</Button><Button variant="secondary" to="/app/delivery-notes">Back to delivery notes</Button></div></div>
  const lineCount = Array.isArray(record.items) ? record.items.length : 0
  const sentCount = Number(record.sent_count ?? history.length) || 0

  return <div className={`${styles.page} fx-enter`}>
    <div className={styles.toolbar}><Link className={styles.back} to="/app/delivery-notes"><ArrowLeft size={15} /> Delivery Notes</Link>
      <div className={styles.actions}><Button variant="secondary" icon={RefreshCw} size="sm" onClick={() => setRevision((value) => value + 1)}>Refresh</Button>
        {canEdit && editable && <Button icon={PencilLine} size="sm" to={`/app/delivery-notes/${record.id}/edit`}>Edit draft</Button>}</div>
    </div>
    <section className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.heroIcon}><Truck size={24} aria-hidden="true" /></span>
        <div className={styles.heroText}><span className={styles.eyebrow}>Delivery note</span><h1 className="num ref">{deliveryReference(record)}</h1>
          <p>{record.customer_name_snapshot || 'Customer'} · {formatDate(record.delivery_date)}</p></div>
        <div className={styles.badges}><StatusBadge status={record.status} tone={deliveryStatusTone(record.status)} label={deliveryStatusLabel(record.status)} /></div>
      </div>
      <p className={extra.note}><Info size={16} aria-hidden="true" /> This delivery note records quantities delivered against an approved invoice. It is not a separate NRS tax invoice or clearance.</p>
    </section>
    <div className={styles.summaryGrid}>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><PackageCheck size={19} /></span><span>Invoice lines delivered</span><strong className="num">{lineCount}</strong><small>Source invoice quantities</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><Truck size={19} /></span><span>Source invoice</span><strong className="num ref">{record.invoice_number || `Invoice #${record.invoice_id}`}</strong><small>See quantities and units per line</small></div>
      <div className={styles.metric}><span className={styles.metricIcon} aria-hidden="true"><CalendarDays size={19} /></span><span>Delivery date</span><strong className="num">{formatDate(record.delivery_date)}</strong><small>{issued ? 'Document issued' : 'Draft delivery date'}</small></div>
    </div>
    <div className={styles.twoCol}>
      <DetailCard icon={UserRound} title="Customer and source invoice"><dl className={styles.details}>
        <DetailRow label="Customer" value={record.customer_name_snapshot} /><DetailRow label="Email" value={record.customer_email_snapshot} />
        <DetailRow label="Invoice" value={record.invoice_number || `Invoice #${record.invoice_id}`} number />
        <DetailRow label="Invoice date" value={formatDate(record.invoice_date)} number />
        <DetailRow label="Reference" value={record.reference} number /></dl>
        {canViewInvoices && <Link className={styles.back} to={`/app/invoices/${record.invoice_id}`}>View source invoice</Link>}
      </DetailCard>
      <DetailCard icon={MapPin} title="Delivery details"><dl className={styles.details}>
        <DetailRow label="Delivery date" value={formatDate(record.delivery_date)} number />
        <DetailRow label="Address" value={record.delivery_address || record.customer_address_snapshot} />
        <DetailRow label="Issued by" value={record.issued_by_name} />
        <DetailRow label="Issued at" value={record.issued_at ? formatDate(record.issued_at) : 'Not issued'} number /></dl>
        <p className={styles.textBlock}>{record.notes || 'No additional delivery notes supplied.'}</p>
      </DetailCard>
    </div>
    <DetailCard icon={PackageCheck} title="Dispatched invoice lines">
      <div className={extra.lineTable}>
        {(record.items || []).map((line) => <div className={extra.lineRow} key={line.id || line.invoice_item_id}>
          <div><strong>{line.item_name_snapshot || 'Invoice item'}</strong><small>{line.item_description_snapshot || line.item_code_snapshot || '—'}</small></div>
          <div><small>Invoiced</small><strong className="num">{line.invoice_quantity} {line.unit_code_snapshot || ''}</strong></div>
          <div><small>Delivered</small><strong className="num">{line.delivered_quantity} {line.unit_code_snapshot || ''}</strong></div>
        </div>)}
      </div>
    </DetailCard>
    <DetailCard icon={Printer} title="Delivery note document" description={issued ? 'Print, download, email or share this issued document.' : 'Draft preview only. Issue before sending or downloading customer documents.'}>
      <div className={styles.outputActions}>
        <Button variant="secondary" icon={Printer} disabled={!issued || !model} onClick={() => window.print()}>Print</Button>
        <Button variant="secondary" icon={Download} disabled={!issued || !model} loading={pdfBusy} onClick={download}>Download PDF</Button>
        {canSend && <Button icon={Mail} disabled={!issued || !model} onClick={() => { setSendError(''); setSendOpen(true) }}>Send to customer</Button>}
        {canShare && <Button variant="secondary" icon={Link2} disabled={!issued} onClick={() => setLinkOpen(true)}>Secure link</Button>}
      </div>
      <div className={styles.deliveryStrip}><span><strong className="num">{sentCount}</strong> email send{sentCount === 1 ? '' : 's'}</span>
        <span>Last sent: {record.last_sent_at ? formatDate(record.last_sent_at) : 'Not sent yet'}</span><span>Sent by: {record.last_sent_by_name || '—'}</span></div>
      <div className={styles.previewArea} ref={previewRef} aria-label="Delivery note document preview">
        {model ? <div className={styles.scaledPreview} style={{ zoom: previewScale }}><DocumentSheet model={model} /></div>
          : <p className={styles.previewUnavailable}>Organisation document details are unavailable.</p>}
      </div>
    </DetailCard>
    <DetailCard icon={CalendarDays} title="Delivery history">
      {history.length ? <div className={styles.history}>{history.map((entry) => <div key={entry.id}>
        <strong>{entry.recipient_name || entry.recipient_email || 'Customer'}</strong>
        <small>{entry.recipient_email} · {formatDate(entry.sent_at || entry.created_at)} · {entry.attached_pdf ? 'PDF attached' : 'Template only'}</small>
        <small>{entry.delivery_status || 'Sent'}</small>
      </div>)}</div> : <p className={styles.textBlock}>This delivery note has not been sent by email yet.</p>}
    </DetailCard>
    {canEdit && editable && <button type="button" className={styles.archive} onClick={() => setArchiveOpen(true)}><Archive size={16} /> Archive draft delivery note</button>}
    <ConfirmDialog open={archiveOpen} title="Archive this delivery note draft?" message="Archived drafts are removed from active records. Issued delivery notes cannot be archived."
      variant="danger" confirmLabel="Archive draft" loading={archiveBusy} onConfirm={archive} onClose={() => !archiveBusy && setArchiveOpen(false)} />
    {canSend && <SendDeliveryDialog open={sendOpen} record={record} busy={sendBusy} error={sendError}
      onClose={() => !sendBusy && setSendOpen(false)} onSend={send} />}
    {canShare && <InvoiceSecureLinkDialog open={linkOpen} document={record} documentType="delivery_note" toast={toast} onClose={() => setLinkOpen(false)} />}
    {issued && model && createPortal(<div className="di-invoice-print-portal"><DocumentSheet model={model} /></div>, document.body)}
  </div>
}
