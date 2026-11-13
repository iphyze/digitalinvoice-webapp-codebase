import { useEffect, useState } from 'react'
import { Copy, Link2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Alert from '../../components/ui/Alert'
import portalLinkService from '../../services/portalLinkService'
import { getErrorMessage } from '../../utils/httpError'
import styles from './InvoiceDialogs.module.css'

const expiries = [7, 14, 30, 60, 90, 365].map((days) => ({ value: String(days), label: `${days} days` }))
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export default function InvoiceSecureLinkDialog({ open, invoice, document: documentRecord, documentType = 'invoice', onClose, toast }) {
  // Backward-compatible with invoice callers; credit notes use the same portal API.
  const record = documentRecord || invoice
  const documentLabel = { credit_note: 'credit note', proforma_invoice: 'proforma invoice', delivery_note: 'delivery note', payment_receipt: 'payment receipt' }[documentType] || 'invoice'
  const [form, setForm] = useState({ expires_in_days: '30', recipient_email: '', recipient_name: '' })
  const [links, setLinks] = useState([])
  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revokeId, setRevokeId] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!open || !record?.id) return undefined
    let active = true
    setLoading(true)
    setLinks([])
    setError('')
    portalLinkService.list({ document_type: documentType, document_id: record.id }).then((response) => {
      if (active) setLinks(Array.isArray(response.data?.data?.links) ? response.data.data.links : [])
    }).catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Unable to load existing links.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, record?.id, documentType, reload])
  useEffect(() => {
    if (!open) { setCreated(null); setRevokeId(null); return }
    setCreated(null)
    setRevokeId(null)
    setForm({ expires_in_days: '30', recipient_email: record?.customer_email_snapshot || '', recipient_name: record?.customer_name_snapshot || '' })
  }, [open, record?.id, documentType])

  const create = async () => {
    if (busy) return
    if (form.recipient_email.trim() && !isEmail(form.recipient_email.trim())) { setError('Enter a valid recipient email.'); return }
    if (form.recipient_name.trim().length > 120) { setError('Recipient name must be 120 characters or less.'); return }
    setBusy(true)
    setError('')
    try {
      const response = await portalLinkService.create({
        document_type: documentType, document_id: Number(record.id),
        expires_in_days: Number(form.expires_in_days), recipient_email: form.recipient_email.trim() || null,
        recipient_name: form.recipient_name.trim() || null,
      })
      const link = response.data?.data?.link
      if (!link?.portal_url) throw new Error('The portal link URL was missing from the response.')
      setCreated(link)
      setReload((value) => value + 1)
      toast(response.data?.message || 'Secure customer link generated.', 'success', 'Secure link created')
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to create a secure link.')) }
    finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(created.portal_url); toast('Secure link copied.', 'success', 'Copied') }
    catch { setError('Clipboard access is unavailable. Select the link text and copy it manually.') }
  }
  const revoke = async () => {
    if (!revokeId || busy) return
    setBusy(true)
    setError('')
    try {
      await portalLinkService.revoke(revokeId)
      setRevokeId(null)
      setReload((value) => value + 1)
      toast('Secure link revoked.', 'success', 'Access revoked')
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to revoke this link.')) }
    finally { setBusy(false) }
  }

  return <Modal open={open} onClose={onClose} title="Secure customer portal link" eyebrow="Private document access"
    description="Generate a time-limited customer link. Revoked and expired links cannot be used."
    size="lg" busy={busy} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Close</Button><Button icon={Link2} loading={busy && !revokeId} onClick={create} disabled={busy}>Generate link</Button></>}>
    <div className={styles.form}>
      {error && <Alert tone="danger" title="Secure links unavailable">{error}</Alert>}
      <div className={styles.formGrid}>
        <Select label="Link expires after" value={form.expires_in_days} options={expiries} onChange={(value) => setForm((current) => ({ ...current, expires_in_days: value }))} />
        <TextField label="Recipient email" value={form.recipient_email} onChange={(event) => setForm((current) => ({ ...current, recipient_email: event.target.value }))} placeholder="customer@example.com" />
        <TextField label="Recipient name" value={form.recipient_name} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} />
      </div>
      {created?.portal_url && <div className={styles.created} role="status"><ShieldCheck size={19} aria-hidden="true" /><div><strong>{created.email_sent ? 'Link generated and emailed' : 'Link generated'}</strong><p className="num">{created.portal_url}</p><small>Copy this URL now. It cannot be retrieved again from the list.</small></div><Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copy</Button></div>}
      <div className={styles.listTitle}><h3>Existing links</h3><Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setReload((value) => value + 1)} loading={loading}>Refresh</Button></div>
      {loading ? <p className={styles.note}>Checking secure links…</p> : links.length ? <div className={styles.linkList}>
        {links.map((link) => <article className={styles.linkRow} key={link.id}>
          <div><strong>{link.recipient_name || link.recipient_email || 'Customer link'}</strong>
            <small>Expires: {link.expires_at || '—'} · {link.revoked_at ? 'Revoked' : 'Not revoked'}</small></div>
          {!link.revoked_at && (revokeId === link.id
            ? <div className={styles.inlineActions}><Button size="sm" variant="secondary" onClick={() => setRevokeId(null)} disabled={busy}>Cancel</Button><Button size="sm" variant="danger" onClick={revoke} loading={busy}>Confirm revoke</Button></div>
            : <Button size="sm" variant="secondary" icon={XCircle} onClick={() => setRevokeId(link.id)}>Revoke</Button>)}
        </article>)}
      </div> : <p className={styles.note}>No secure links have been created for this {documentLabel}.</p>}
    </div>
  </Modal>
}
