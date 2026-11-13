import { useEffect, useState } from 'react'
import { ArrowRight, Coins, Hash, Landmark, Plus, Trash2, UserRound } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Spinner from '../../../components/ui/Spinner'
import TextField from '../../../components/forms/TextField'
import Select from '../../../components/forms/Select'
import Switch from '../../../components/forms/Switch'
import onboardingService from '../../../services/onboardingService'
import useToastStore from '../../../stores/useToastStore'
import { getErrorMessage } from '../../../utils/httpError'
import { removeFieldError, validateBankAccountForm } from '../../../utils/validation'
import { CURRENCIES } from './InvoiceSettingsStep'
import { StepActions, StepHeader } from './StepParts'
import styles from '../Onboarding.module.css'

const INITIAL = { bank_name: '', account_name: '', account_number: '', currency: 'NGN', is_default: true }

export default function BankAccountStep({ accounts = [], onAccountsChanged, onBack, onContinue, progressLabel }) {
  const showToast = useToastStore((s) => s.showToast)
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    if (accounts.length) setForm((current) => ({ ...current, is_default: false }))
  }, [accounts.length])

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => removeFieldError(current, name))
  }

  const save = async (event) => {
    event.preventDefault()
    const validationErrors = validateBankAccountForm(form)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      showToast('Please correct the highlighted payment account details.', 'warning', 'Check account details')
      return
    }
    setSaving(true)
    try {
      const response = await onboardingService.addBankAccount(form)
      const bankAccounts = response.data?.data?.bank_accounts || []
      onAccountsChanged(bankAccounts)
      setForm({ ...INITIAL, is_default: bankAccounts.length === 0 })
      showToast('Payment account added successfully.', 'success', 'Account saved')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to add payment account.'), 'error', 'Unable to save account')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    setRemoving(id)
    try {
      const response = await onboardingService.removeBankAccount(id)
      onAccountsChanged(response.data?.data?.bank_accounts || [])
      showToast('Payment account removed.', 'success', 'Account removed')
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to remove payment account.'), 'error', 'Unable to remove account')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      <StepHeader icon={Landmark} eyebrow="Optional setup" title="Payment account"
        description="Add a bank account to show payment instructions on invoices, or complete setup now." />

      {accounts.length ? (
        <ul className={styles.accounts}>
          {accounts.map((account) => (
            <li key={account.id} className={styles.account}>
              <span className={styles.accountIcon}><Landmark size={18} aria-hidden="true" /></span>
              <div className={styles.accountText}>
                <strong>{account.bank_name}</strong>
                <p className="num">{account.account_name} · {account.account_number} · {account.currency}</p>
              </div>
              {Number(account.is_default) === 1 ? <span className={styles.defaultChip}>Default</span> : null}
              <button type="button" className={styles.remove} disabled={removing === account.id} onClick={() => remove(account.id)} aria-label="Remove bank account">
                {removing === account.id ? <Spinner size={15} /> : <Trash2 size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={save} noValidate className={styles.accountForm}>
        <div className={styles.grid}>
          <TextField id="bank_name" name="bank_name" label="Bank name" icon={Landmark} required autoComplete="organization" placeholder="Your bank name"
            value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} error={errors.bank_name} />
          <TextField id="account_name" name="account_name" label="Account name" icon={UserRound} required autoComplete="name" placeholder="Account holder name"
            value={form.account_name} onChange={(e) => update('account_name', e.target.value)} error={errors.account_name} />
          <TextField id="account_number" name="account_number" label="Account number" icon={Hash} required inputMode="numeric" autoComplete="off" placeholder="0123456789"
            value={form.account_number} onChange={(e) => update('account_number', e.target.value.replace(/\D/g, ''))} error={errors.account_number} />
          <Select id="account_currency" label="Currency" icon={Coins} options={CURRENCIES}
            value={form.currency} onChange={(v) => update('currency', v)} error={errors.currency} />
        </div>
        <div className={styles.switches}>
          <Switch id="is_default" label="Use as default payment account" description="Preselect this account on new invoices."
            checked={form.is_default} onChange={(v) => update('is_default', v)} />
          <div className={styles.addAction}>
            <Button type="submit" variant="secondary" size="lg" icon={Plus} loading={saving}>Add payment account</Button>
          </div>
        </div>
      </form>

      <StepActions progressLabel={progressLabel} onBack={onBack}>
        <Button size="lg" iconRight={ArrowRight} onClick={onContinue}>Continue to review</Button>
      </StepActions>
    </div>
  )
}
