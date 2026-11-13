import { CalendarRange } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import TextField from '../../components/forms/TextField'
import {
  REPORT_CURRENCIES, REPORT_PERIOD_OPTIONS, reportPresetDates,
} from './reportModel'
import styles from './Reports.module.css'

/** Applied filters are separate from draft filters: results always match the last submitted form. */
export default function ReportFilters({ type, draft, onChange, onApply, error, loading, extraOptions = [] }) {
  const aging = type === 'aging'
  const change = (key, value) => onChange((previous) => ({ ...previous, [key]: value }))
  const choosePeriod = (value) => onChange((previous) => value === 'custom'
    ? { ...previous, preset: value }
    : { ...previous, preset: value, ...reportPresetDates(value) })
  return <form className={styles.filterBox} onSubmit={(event) => { event.preventDefault(); onApply() }} aria-label="Report filters">
    <div className={styles.filterGrid}>
      {aging ? <DatePicker label="Aging as at" value={draft.aging_date} onChange={(value) => change('aging_date', value)} /> : <>
        <Select label="Period" value={draft.preset} onChange={choosePeriod} options={REPORT_PERIOD_OPTIONS} />
        <DatePicker label="From" value={draft.from} onChange={(value) => onChange((previous) => ({ ...previous, preset: 'custom', from: value }))} />
        <DatePicker label="To" value={draft.to} onChange={(value) => onChange((previous) => ({ ...previous, preset: 'custom', to: value }))} />
      </>}
      <Select label="Currency" value={draft.currency} onChange={(value) => change('currency', value)} options={REPORT_CURRENCIES} />
      {['invoices', 'payments', 'vat'].includes(type) &&
        <TextField size="md" label="Search" value={draft.search} maxLength={121} placeholder="Customer or reference" onChange={(event) => change('search', event.target.value)} />}
      {extraOptions.map(({ key, label, options }) => <Select key={key} label={label} value={draft[key]} onChange={(value) => change(key, value)} options={options} />)}
      <Button type="submit" icon={CalendarRange} loading={loading} className={styles.apply}>Apply filters</Button>
    </div>
    {error && <p role="alert" className={styles.errorText}>{error}</p>}
    <p className={styles.filterHint}>{aging
      ? 'Aging uses current invoice balances relative to the selected date; it is not a historical balance reconstruction.'
      : 'Results are scoped to the selected dates and one currency. Changes apply when you select Apply filters.'}</p>
  </form>
}
