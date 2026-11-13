import { useEffect, useState } from 'react'
import { Building2, Coins, Hash, Save, UserRound } from 'lucide-react'
import Drawer from '../../components/overlays/Drawer'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import Switch from '../../components/forms/Switch'
import onboardingService from '../../services/onboardingService'
import useToastStore from '../../stores/useToastStore'
import { validateBankAccountForm } from '../../utils/validation'
import { getErrorMessage } from '../../utils/httpError'
import { INVOICE_CURRENCIES } from './invoiceEditorOptions'
import styles from '../customers/CustomerFormDrawer.module.css'

const freshAccount = (currency) => ({ bank_name: '', account_name: '', account_number: '', currency: currency || 'NGN', is_default: false })

/** Matches the existing Customer and Catalogue drawers, not the legacy drawer markup. */
export default function InvoicePaymentAccountDrawer({ open, currency, onClose, onSaved }) {
  const toast = useToastStore((s) => s.showToast)
  const [form, setForm] = useState(() => freshAccount(currency))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setForm(freshAccount(currency)); setErrors({}); setSubmitted(false) }
  }, [open, currency])

  const update = (key, value) => {
    const next = { ...form, [key]: value }
    setForm(next)
    if (submitted) setErrors(validateBankAccountForm(next))
  }
  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const nextErrors = validateBankAccountForm(form)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast('Please correct the highlighted payment account details.', 'warning', 'Check account details')
      return
    }
    setSaving(true)
    try {
      const response = await onboardingService.addBankAccount({ ...form, is_default: form.is_default ? 1 : 0 })
      const accounts = response.data?.data?.bank_accounts || []
      const saved = accounts.find((account) => String(account.account_number) === form.account_number
        && account.currency === form.currency
        && String(account.bank_name).toLowerCase() === form.bank_name.trim().toLowerCase()) || accounts.at(-1)
      // Do not claim the newly created record was selected unless the API returned it.
      if (!saved?.id) throw new Error('The account could not be confirmed in the server response. Refresh the account list before selecting it.')
      toast('Payment account added and selected on this invoice.', 'success', 'Account ready')
      onSaved?.(accounts, saved)
    } catch (error) {
      toast(getErrorMessage(error, error.message || 'Unable to add this payment account.'), 'error', 'Could not save account')
    } finally { setSaving(false) }
  }
  return <Drawer open={open} onClose={onClose} busy={saving} eyebrow="Payment destination" title="Add payment account"
    description="Create an account and select it on this draft without leaving the invoice."
    footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" form="invoice-payment-account-form" icon={Save} loading={saving}>Add and select account</Button></>}>
    <form id="invoice-payment-account-form" className={styles.form} onSubmit={submit} noValidate>
      <section className={styles.section}>
        <h3>Account details</h3>
        <div className={styles.grid}>
          <TextField id="quick-bank-name" size="md" label="Bank name *" icon={Building2} value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} error={errors.bank_name} placeholder="Bank name" autoComplete="organization" />
          <TextField id="quick-bank-holder" size="md" label="Account name *" icon={UserRound} value={form.account_name} onChange={(e) => update('account_name', e.target.value)} error={errors.account_name} placeholder="Account holder name" autoComplete="name" />
          <div className={styles.span}><TextField id="quick-bank-number" size="md" label="Account number *" icon={Hash} inputMode="numeric" value={form.account_number} onChange={(e) => update('account_number', e.target.value.replace(/\D/g, ''))} error={errors.account_number} placeholder="0123456789" autoComplete="off" /></div>
          <div className={styles.span}><Select id="quick-bank-currency" size="md" label="Currency *" icon={Coins} value={form.currency} options={INVOICE_CURRENCIES} error={errors.currency} isDisabled /></div>
        </div>
      </section>
      <section className={styles.section}><Switch id="quick-bank-default" label="Use as default payment account" description="Preselect this account on suitable new invoices." checked={form.is_default} onChange={(v) => update('is_default', v)} /></section>
    </form>
  </Drawer>
}
