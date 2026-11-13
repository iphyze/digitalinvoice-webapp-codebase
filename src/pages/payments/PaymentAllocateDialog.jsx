import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, WalletCards } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import Select from '../../components/forms/Select'
import TextField from '../../components/forms/TextField'
import Alert from '../../components/ui/Alert'
import invoiceService from '../../services/invoiceService'
import paymentService from '../../services/paymentService'
import { outstandingInvoicesFromResponse } from '../../utils/paymentPayload'
import { getErrorMessage } from '../../utils/httpError'
import { moneyToMinor, paymentMoney, validatePaymentAllocations } from './paymentModel'
import styles from './Payments.module.css'

const freshRow = () => ({ invoice_id: '', amount: '' })

export default function PaymentAllocateDialog({ open, payment, onClose, onSaved }) {
  const [invoices, setInvoices] = useState([])
  const [rows, setRows] = useState([freshRow()])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [errors, setErrors] = useState({})
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!open || !payment?.id) return undefined
    let active = true
    setInvoices([])
    setRows([freshRow()])
    setErrors({})
    setRequestError('')
    setLoadError('')
    setLoading(true)
    invoiceService.outstanding({ customer_id: payment.customer_id, currency: payment.currency })
      .then((response) => {
        if (active) setInvoices(outstandingInvoicesFromResponse(response).filter((invoice) =>
          Number(invoice.customer_id) === Number(payment.customer_id) && invoice.currency === payment.currency && Number(invoice.balance_due) > 0))
      }).catch((error) => { if (active) setLoadError(getErrorMessage(error, 'Unable to load outstanding invoices.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, payment?.id, payment?.customer_id, payment?.currency, retry])
  const usedMinor = useMemo(() => rows.reduce((sum, row) => {
    const minor = moneyToMinor(row.amount)
    return sum + (row.invoice_id && Number.isSafeInteger(minor) ? minor : 0)
  }, 0), [rows])
  const remainingMinor = moneyToMinor(payment?.unallocated_amount)
  const availableMinor = Math.max(0, (Number.isSafeInteger(remainingMinor) ? remainingMinor : 0) - usedMinor)
  const update = (index, patch) => {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row))
    setErrors({})
    setRequestError('')
  }
  const save = async () => {
    if (saving) return
    const next = validatePaymentAllocations(payment, rows, invoices)
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setRequestError('')
    try {
      const response = await paymentService.allocate({ payment_id: payment.id,
        allocations: rows.filter((row) => row.invoice_id).map((row) => ({ invoice_id: Number(row.invoice_id), amount: row.amount.trim() })) })
      onSaved?.(response.data?.data?.payment)
    } catch (error) { setRequestError(getErrorMessage(error, 'Unable to allocate this payment.')) }
    finally { setSaving(false) }
  }
  return <Modal open={open} onClose={onClose} busy={saving} size="lg" eyebrow="Invoice settlement" title="Allocate payment"
    description="Apply the unallocated receipt balance to approved invoices for the same customer and currency."
    footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button icon={WalletCards} loading={saving} disabled={loading || Boolean(loadError) || !invoices.length} onClick={save}>Allocate payment</Button></>}>
    <div className={styles.form}>
      <div className={styles.allocationSummary}><div><span>Unallocated balance</span><strong className="num">{paymentMoney(payment?.unallocated_amount, payment?.currency)}</strong></div>
        <div><span>After this allocation</span><strong className="num">{paymentMoney(availableMinor / 100, payment?.currency)}</strong></div></div>
      {requestError && <Alert tone="danger" title="Allocation not saved">{requestError}</Alert>}
      {loadError && <div className={styles.errorPanel}><Alert tone="danger" title="Invoices unavailable">{loadError}</Alert><Button size="sm" variant="secondary" onClick={() => setRetry((v) => v + 1)}>Retry</Button></div>}
      {loading ? <p className={styles.hint} role="status">Loading outstanding invoices…</p> : !loadError && !invoices.length ?
        <Alert tone="info" title="No outstanding invoices">This customer has no eligible approved invoices in {payment?.currency}.</Alert> : null}
      {!loading && !loadError && invoices.length > 0 && <div className={styles.allocationRows}>
        {rows.map((row, index) => {
          const selected = invoices.find((item) => String(item.id) === String(row.invoice_id))
          const choices = invoices.filter((item) => String(item.id) === String(row.invoice_id) || !rows.some((entry, i) => i !== index && String(entry.invoice_id) === String(item.id)))
          return <div className={styles.allocationRow} key={index}>
            <div className={styles.allocationFields}>
              <Select label={`Invoice ${index + 1}`} options={choices.map((invoice) => ({ value: String(invoice.id), label: `${invoice.invoice_number} · ${paymentMoney(invoice.balance_due, invoice.currency)} due` }))}
                value={row.invoice_id} isSearchable onChange={(value) => update(index, { invoice_id: value, amount: '' })} error={errors[index]} />
              <TextField label={`Amount (${payment?.currency})`} inputMode="decimal" value={row.amount} placeholder="0.00"
                onChange={(event) => update(index, { amount: event.target.value })} hint={selected ? `Outstanding: ${paymentMoney(selected.balance_due, payment.currency)}` : undefined} />
            </div>
            {rows.length > 1 && <button type="button" className={styles.removeRow} onClick={() => { setRows((current) => current.filter((_, i) => i !== index)); setErrors({}) }} aria-label={`Remove allocation ${index + 1}`}><Trash2 size={17} /></button>}
          </div>
        })}
        {errors.general && <p className={styles.error} role="alert">{errors.general}</p>}
        {rows.length < Math.min(100, invoices.length) && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setRows((current) => [...current, freshRow()])}>Add another invoice</Button>}
        <p className={styles.hint}>Only outstanding approved invoices are returned (up to 200). Invoice balances will be recalculated by the backend.</p>
      </div>}
    </div>
  </Modal>
}
