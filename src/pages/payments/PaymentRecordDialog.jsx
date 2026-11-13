import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote } from 'lucide-react'
import Modal from '../../components/overlays/Modal'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import customerService from '../../services/customerService'
import onboardingService from '../../services/onboardingService'
import paymentService from '../../services/paymentService'
import { INVOICE_CURRENCIES } from '../invoices/invoiceEditorOptions'
import { paymentMethodOptions } from '../../components/documents/labels'
import { bankAccountsFromResponse, buildPaymentPayload, customerListFromResponse } from '../../utils/paymentPayload'
import { getErrorMessage } from '../../utils/httpError'
import { dateToday, validatePaymentRecord } from './paymentModel'
import styles from './Payments.module.css'

const initial = () => ({ customer_id: '', payment_date: dateToday(), currency: 'NGN', amount: '', payment_method: 'bank_transfer', bank_account_id: '', reference: '', payer_name: '', notes: '' })
const customerOption = (customer) => ({ value: String(customer.id), label: customer.name || customer.customer_name || `Customer #${customer.id}`, customer })

export default function PaymentRecordDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState(initial)
  const [customer, setCustomer] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [accountsError, setAccountsError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    setForm(initial())
    setCustomer(null)
    setAccounts([])
    setErrors({})
    setRequestError('')
    setAccountsError('')
    onboardingService.getBankAccounts().then((response) => {
      if (active) setAccounts(bankAccountsFromResponse(response).filter((entry) => Number(entry.is_active ?? 1) === 1))
    }).catch(() => { if (active) setAccountsError('Payment bank accounts could not be loaded; you can record without a bank account.') })
    return () => { active = false }
  }, [open])

  const searchCustomers = useCallback(async (input) => {
    const response = await customerService.list({ search: input?.trim() || undefined, status: 'active', limit: 100 })
    return customerListFromResponse(response).map(customerOption)
  }, [])
  const accountOptions = useMemo(() => accounts.filter((account) => account.currency === form.currency)
    .map((account) => ({ value: String(account.id), label: `${account.bank_name} · ${account.account_name || ''} · ${account.account_number || ''}` })), [accounts, form.currency])
  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value, ...(field === 'currency' ? { bank_account_id: '' } : {}) }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setRequestError('')
  }
  const selectCustomer = (option) => {
    setCustomer(option)
    setForm((current) => ({ ...current, customer_id: option?.value || '', currency: option?.customer?.preferred_currency || current.currency, bank_account_id: '' }))
    setErrors((current) => ({ ...current, customer_id: '' }))
    setRequestError('')
  }
  const save = async () => {
    if (saving) return
    const nextErrors = validatePaymentRecord(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    setRequestError('')
    try {
      const response = await paymentService.record(buildPaymentPayload(form))
      const saved = response.data?.data?.payment
      if (!saved?.id) throw new Error('Payment was recorded, but the receipt identifier was not returned. Refresh Payments to locate it.')
      onSaved?.(saved)
    } catch (error) { setRequestError(getErrorMessage(error, 'Unable to record the payment.')) }
    finally { setSaving(false) }
  }

  return <Modal open={open} onClose={onClose} busy={saving} size="lg" eyebrow="Customer receipts" title="Record payment"
    description="Record money received from a customer. You can allocate the receipt to approved invoices after saving."
    footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button icon={Banknote} loading={saving} onClick={save}>Record payment</Button></>}>
    <div className={styles.form}>
      {requestError && <Alert tone="danger" title="Payment not recorded">{requestError}</Alert>}
      <Select label="Customer" value={customer} onChange={selectCustomer} loadOptions={searchCustomers}
        placeholder="Search active customers…" error={errors.customer_id} isClearable />
      <div className={styles.formGrid}>
        <DatePicker label="Payment date" value={form.payment_date} onChange={(value) => change('payment_date', value)} error={errors.payment_date} />
        <Select label="Currency" value={form.currency} options={INVOICE_CURRENCIES} onChange={(value) => change('currency', value)} error={errors.currency} />
        <TextField label={`Amount received (${form.currency})`} inputMode="decimal" value={form.amount} onChange={(event) => change('amount', event.target.value)} error={errors.amount} placeholder="0.00" />
        <Select label="Payment method" value={form.payment_method} options={paymentMethodOptions} onChange={(value) => change('payment_method', value)} error={errors.payment_method} />
        <Select label="Bank account (optional)" options={accountOptions} value={form.bank_account_id} onChange={(value) => change('bank_account_id', value)} isClearable placeholder="No bank account selected" />
        <TextField label="Payment reference (optional)" maxLength={120} value={form.reference} onChange={(event) => change('reference', event.target.value)} error={errors.reference} />
        <TextField label="Payer name (optional)" maxLength={180} value={form.payer_name} onChange={(event) => change('payer_name', event.target.value)} error={errors.payer_name} />
      </div>
      {accountsError && <p className={styles.hint} role="status">{accountsError}</p>}
      <Textarea label="Notes (optional)" rows={3} maxLength={1000} value={form.notes} onChange={(event) => change('notes', event.target.value)} error={errors.notes} />
      <p className={styles.hint}>Saving creates a customer receipt. No invoice amount is changed until an allocation is made.</p>
    </div>
  </Modal>
}
