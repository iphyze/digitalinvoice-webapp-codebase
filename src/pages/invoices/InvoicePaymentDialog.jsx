import { useEffect, useState } from 'react'
import { Banknote } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import DatePicker from '../../components/forms/DatePicker'
import Select from '../../components/forms/Select'
import Alert from '../../components/ui/Alert'
import onboardingService from '../../services/onboardingService'
import paymentService from '../../services/paymentService'
import { bankAccountsFromResponse, buildPaymentPayload } from '../../utils/paymentPayload'
import { paymentMethodOptions } from '../../components/documents/labels'
import { getErrorMessage } from '../../utils/httpError'
import { invoiceMoney } from './invoiceDetailsModel'
import styles from './InvoiceDialogs.module.css'

const todayLocal = () => {
  const day = new Date()
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

export default function InvoicePaymentDialog({ open, invoice, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [requestError, setRequestError] = useState('')
  const balance = Math.max(0, Number(invoice?.balance_due ?? 0))

  useEffect(() => {
    if (!open || !invoice) return undefined
    let active = true
    setForm({
      customer_id: String(invoice.customer_id || ''), payment_date: todayLocal(),
      currency: invoice.currency || 'NGN', amount: balance.toFixed(2), payment_method: 'bank_transfer',
      bank_account_id: '', reference: '', payer_name: '', notes: '',
    })
    setErrors({})
    setRequestError('')
    setAccounts([])
    setLoadingAccounts(true)
    onboardingService.getBankAccounts().then((response) => {
      if (active) setAccounts(bankAccountsFromResponse(response).filter((account) => Number(account.is_active ?? 1) === 1))
    }).catch(() => { /* Bank account is optional; payment recording remains available. */ })
      .finally(() => { if (active) setLoadingAccounts(false) })
    return () => { active = false }
  }, [open, invoice?.id, invoice?.balance_due, invoice?.currency, invoice?.customer_id])

  const change = (key, value) => { setForm((previous) => ({ ...previous, [key]: value })); setErrors((previous) => ({ ...previous, [key]: '' })); setRequestError('') }
  const save = async () => {
    if (!form || saving) return
    const amount = Number(form.amount)
    const next = {}
    if (!form.payment_date) next.payment_date = 'Payment date is required.'
    if (!Number.isFinite(amount) || amount <= 0) next.amount = 'Enter an amount greater than zero.'
    else if (Math.round(amount * 100) > Math.round(balance * 100)) next.amount = 'The allocation cannot exceed the outstanding balance.'
    else if (!/^\d+(?:\.\d{1,2})?$/.test(String(form.amount))) next.amount = 'Use up to two decimal places.'
    if (!form.payment_method) next.payment_method = 'Select a payment method.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setRequestError('')
    try {
      const payload = buildPaymentPayload(form, [{ invoice_id: Number(invoice.id), amount: form.amount }])
      const result = await paymentService.record(payload)
      onSaved?.(result)
    } catch (error) { setRequestError(getErrorMessage(error, 'Unable to record this payment.')) }
    finally { setSaving(false) }
  }
  return <Modal open={open} onClose={onClose} busy={saving} size="md" eyebrow="Receipt entry" title="Record customer payment"
    description="Capture the payment and allocate it to this approved invoice."
    footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button icon={Banknote} loading={saving} disabled={!form} onClick={save}>Record payment</Button></>}>
    {form && <div className={styles.form}>
      <div className={styles.summary}><span>Outstanding balance</span><strong className="num">{invoiceMoney(balance, invoice?.currency)}</strong><small>{invoice?.customer_name_snapshot} · {invoice?.invoice_number || `Invoice #${invoice?.id}`}</small></div>
      {requestError && <Alert tone="danger" title="Payment not saved">{requestError}</Alert>}
      <div className={styles.formGrid}>
        <DatePicker label="Payment date" value={form.payment_date} onChange={(value) => change('payment_date', value)} error={errors.payment_date} />
        <TextField label={`Amount received (${form.currency})`} value={form.amount} onChange={(event) => change('amount', event.target.value)} inputMode="decimal" error={errors.amount} />
        <Select label="Payment method" options={paymentMethodOptions} value={form.payment_method} onChange={(value) => change('payment_method', value)} error={errors.payment_method} />
        <Select label="Bank account (optional)" options={accounts.filter((account) => account.currency === form.currency).map((account) => ({ value: String(account.id), label: `${account.bank_name} · ${account.account_number}` }))}
          value={form.bank_account_id} onChange={(value) => change('bank_account_id', value)} isDisabled={loadingAccounts} placeholder="No bank account selected" isClearable />
        <TextField label="Reference (optional)" value={form.reference} onChange={(event) => change('reference', event.target.value)} maxLength={120} />
        <TextField label="Payer name (optional)" value={form.payer_name} onChange={(event) => change('payer_name', event.target.value)} maxLength={180} />
      </div>
      <p className={styles.note}>The recorded amount will be allocated entirely to this invoice. A payment cannot exceed its current outstanding balance.</p>
    </div>}
  </Modal>
}
