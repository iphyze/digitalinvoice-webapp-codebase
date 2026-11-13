import { useState } from 'react'
import { ArrowRight, Building2, FileText, LineChart, Mail, Phone, ShieldCheck, User, Users } from 'lucide-react'
import PublicHeader from '../../components/public/PublicHeader'
import Button from '../../components/ui/Button'
import TextField from '../../components/forms/TextField'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import Textarea from '../../components/forms/Textarea'
import authService from '../../services/authService'
import useToastStore from '../../stores/useToastStore'
import { getErrorMessage } from '../../utils/httpError'
import { firstError, validateDemoForm } from '../../utils/validation'
import styles from './RequestDemo.module.css'

/*
  Request demo (approved Sample A: hero continuation of the Landing page).
  Behaviour and copy from the previous app: validateDemoForm, authService.requestDemo,
  the same toasts, form reset on success, past dates unavailable.
*/
const SIZE_OPTIONS = [
  { value: '1-10 employees', label: '1–10 employees' },
  { value: '11-50 employees', label: '11–50 employees' },
  { value: '51-200 employees', label: '51–200 employees' },
  { value: '201+ employees', label: '201+ employees' },
]

const BENEFITS = [
  { icon: FileText, text: 'Invoice workflows' },
  { icon: LineChart, text: 'Reporting insight' },
  { icon: ShieldCheck, text: 'Secure operations' },
]

const INITIAL = { name: '', email: '', company_name: '', phone: '', business_size: '', preferred_date: '', message: '' }

const todayValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RequestDemo() {
  const showToast = useToastStore((state) => state.showToast)
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const updateValue = (name, value) => {
    const next = { ...form, [name]: value }
    setForm(next)
    // Errors appear on submit, then stay up to date as fields are fixed
    if (submitted) setErrors(validateDemoForm(next))
  }
  const onInput = (event) => updateValue(event.target.name, event.target.value)

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    const nextErrors = validateDemoForm(form)
    setSubmitted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      showToast(firstError(nextErrors), 'warning', 'Review your details')
      return
    }
    setLoading(true)
    try {
      await authService.requestDemo(form)
      showToast('Your request has been received. Our team will contact you shortly.', 'success', 'Demo booked')
      setForm(INITIAL)
      setErrors({})
      setSubmitted(false)
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to submit your request.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <PublicHeader />
      <main className={styles.band} id="main-content">
        <span className={styles.glowA} aria-hidden="true" />
        <span className={styles.glowB} aria-hidden="true" />
        <div className={styles.content}>
          <section className={`${styles.copy} fx-stagger`} aria-labelledby="demo-heading">
            <p className={styles.eyebrow}>Book a walkthrough</p>
            <h1 id="demo-heading">See smart invoicing in action.</h1>
            <p className={styles.description}>
              Share a few details and we will arrange a guided product demonstration for your business.
            </p>
            <ul className={styles.benefits}>
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text}><span className={styles.benefitIcon}><Icon size={17} aria-hidden="true" /></span>{text}</li>
              ))}
            </ul>
          </section>

          <form className={`${styles.card} fx-enter`} onSubmit={submit} noValidate aria-label="Request a demo">
            <div className={styles.grid}>
              <TextField id="demo-name" name="name" label="Your name" icon={User} autoComplete="name"
                placeholder="Enter your full name" value={form.name} onChange={onInput} error={errors.name} required />
              <TextField id="demo-email" name="email" type="email" label="Business email" icon={Mail} autoComplete="email"
                placeholder="name@company.com" value={form.email} onChange={onInput} error={errors.email} required />
              <TextField id="demo-company" name="company_name" label="Company name" icon={Building2} autoComplete="organization"
                placeholder="Your registered business" value={form.company_name} onChange={onInput} error={errors.company_name} required />
              <TextField id="demo-phone" name="phone" type="tel" label="Phone number" icon={Phone} autoComplete="tel"
                placeholder="+234..." value={form.phone} onChange={onInput} error={errors.phone} />
              <Select id="demo-size" label="Business size" icon={Users} options={SIZE_OPTIONS} placeholder="Select business size"
                value={form.business_size} onChange={(value) => updateValue('business_size', value)} isClearable />
              <DatePicker id="demo-date" label="Preferred demo date" value={form.preferred_date} min={todayValue()}
                onChange={(value) => updateValue('preferred_date', value)} />
              <Textarea id="demo-message" name="message" label="What would you like to see?" className={styles.span}
                placeholder="Tell us about your invoicing or compliance needs..." value={form.message} onChange={onInput} />
            </div>
            <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight} className={styles.submit}>
              Request a demo
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
