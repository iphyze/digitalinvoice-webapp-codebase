import { forwardRef, useId } from 'react'
import ReactDatePicker from 'react-datepicker'
import { format, isValid, parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'
import styles from './DatePicker.module.css'

/*
  DatePicker on react-datepicker, restyled with design tokens.
  Values are 'YYYY-MM-DD' strings (what the API uses); the field shows
  "Sat, 24 Oct 2026". The calendar renders into document.body (no clipping).

  value / onChange    'YYYY-MM-DD' (or [start, end] with range)
  min / max           'YYYY-MM-DD' limits (earlier/later dates are disabled)
  range               select a date range (for filters)
  label, icon, hint, error, placeholder, id, isClearable, disabled
*/
const toDate = (value) => {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : value
  return isValid(d) ? d : null
}
const toValue = (date) => (date && isValid(date) ? format(date, 'yyyy-MM-dd') : '')

const Trigger = forwardRef(function Trigger({ value, onClick, placeholder, icon: Icon, invalid, describedBy, id, disabled }, ref) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      className={styles.control}
      onClick={onClick}
      data-invalid={invalid ? '' : undefined}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      aria-haspopup="dialog"
      disabled={disabled}
    >
      <Icon size={17} className={styles.icon} aria-hidden="true" />
      <span className={value ? styles.value : styles.placeholder}>{value || placeholder}</span>
    </button>
  )
})

const Header = ({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
  <div className={styles.header}>
    <button type="button" className={styles.nav} onClick={decreaseMonth} disabled={prevMonthButtonDisabled} aria-label="Previous month">
      <ChevronLeft size={16} aria-hidden="true" />
    </button>
    <strong className={styles.month}>{format(date, 'MMMM yyyy')}</strong>
    <button type="button" className={styles.nav} onClick={increaseMonth} disabled={nextMonthButtonDisabled} aria-label="Next month">
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  </div>
)

export default function DatePicker({
  label, icon = CalendarDays, hint, error, value, onChange, min, max, range = false,
  placeholder = 'Choose a date', id, isClearable = false, disabled = false, className = '',
}) {
  const autoId = useId()
  const inputId = id || autoId
  const messageId = `${inputId}-message`
  const message = error || hint
  const common = {
    // react-datepicker passes its own id/placeholder/disabled to the trigger, so they're set here
    id: inputId,
    customInput: <Trigger icon={icon} invalid={Boolean(error)} describedBy={message ? messageId : undefined} />,
    renderCustomHeader: Header,
    minDate: toDate(min),
    maxDate: toDate(max),
    dateFormat: 'EEE, d MMM yyyy',
    calendarStartDay: 1,
    todayButton: 'Today',
    portalId: 'datepicker-portal',
    popperPlacement: 'bottom-start',
    calendarClassName: styles.calendar,
    popperClassName: `${styles.popper} fx-pop`,
    showPopperArrow: false,
    isClearable,
    disabled,
  }
  return (
    <div className={`${styles.field} ${className}`}>
      {label ? <label htmlFor={inputId} className={styles.label}>{label}</label> : null}
      {range ? (
        <ReactDatePicker
          {...common}
          selectsRange
          startDate={toDate(value?.[0])}
          endDate={toDate(value?.[1])}
          onChange={([start, end]) => onChange?.([toValue(start), toValue(end)])}
          placeholderText={placeholder}
        />
      ) : (
        <ReactDatePicker {...common} selected={toDate(value)} onChange={(date) => onChange?.(toValue(date))} placeholderText={placeholder} />
      )}
      {message ? <p id={messageId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>{message}</p> : null}
    </div>
  )
}
