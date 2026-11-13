import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, FileText, Mail, RefreshCw, Send, WalletCards, FileMinus2, FilePlus2 } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import DataTable from '../../components/data/DataTable'
import StatCard from '../../components/data/StatCard'
import Modal from '../../components/overlays/Modal'
import Select from '../../components/forms/Select'
import DatePicker from '../../components/forms/DatePicker'
import TextField from '../../components/forms/TextField'
import Textarea from '../../components/forms/Textarea'
import customerService from '../../services/customerService'
import reportService from '../../services/reportService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { customerListFromResponse } from '../../utils/paymentPayload'
import { hasPermission } from '../../utils/permissions'
import { hasEntitledPermission } from '../../utils/entitlements'
import { getErrorMessage } from '../../utils/httpError'
import {
  createReportFilters, downloadFile, downloadReportCsv, readReport, reportCount,
  reportDate, reportMoney, reportPeriodError, REPORT_CSV_COLUMNS, REPORT_CURRENCIES,
  REPORT_PERIOD_OPTIONS, reportPresetDates, statementFilename, statementSendErrors,
} from './reportModel'
import styles from './Reports.module.css'

const FILE_SIZE_MAX = 4 * 1024 * 1024
const methods = [
  { value: 'template_only', label: 'Branded email summary' },
  { value: 'pdf_attachment', label: 'Email with PDF attached' },
]
const sendStart = () => ({ recipient_email: '', recipient_name: '', message: '', delivery_mode: 'template_only' })
const optionFor = (row) => ({ value: String(row.id), label: row.name || row.customer_name || `Customer #${row.id}`, customer: row })
const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.onerror = () => reject(new Error('Unable to encode the statement PDF.'))
  reader.readAsDataURL(blob)
})
const getPdf = async (data) => {
  const { statementPdfBlob } = await import('./statementPdf')
  return statementPdfBlob(data)
}

export default function CustomerStatement() {
  const permissions = useAuthStore((state) => state.permissions)
  const entitlements = useAuthStore((state) => state.entitlements)
  const toast = useToastStore((state) => state.showToast)
  const canSend = hasPermission(permissions, 'reports.send') && hasEntitledPermission(entitlements, 'reports.send')
  const canInvoice = hasPermission(permissions, 'invoices.view') && hasEntitledPermission(entitlements, 'invoices.view')
  const canCredit = hasPermission(permissions, 'credit_notes.view') && hasEntitledPermission(entitlements, 'credit_notes.view')
  const canPayment = hasPermission(permissions, 'payments.view') && hasEntitledPermission(entitlements, 'payments.view')
  const [filters, setFilters] = useState(() => ({ ...createReportFilters('month_to_date'), customer_id: '' }))
  const [customer, setCustomer] = useState(null)
  const [statement, setStatement] = useState(null)
  const [applied, setApplied] = useState(null)
  const [filterError, setFilterError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileBusy, setFileBusy] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [sendValues, setSendValues] = useState(sendStart)
  const [sendErrors, setSendErrors] = useState({})
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)

  const searchCustomers = useCallback(async (input) => {
    const response = await customerService.list({ search: input?.trim() || undefined, limit: 100 })
    return customerListFromResponse(response).map(optionFor)
  }, [])
  const change = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    if (filterError) setFilterError('')
  }
  const choosePeriod = (value) => {
    setFilterError('')
    setFilters((current) => value === 'custom' ? { ...current, preset: 'custom' }
      : { ...current, preset: value, ...reportPresetDates(value) })
  }
  const generate = async () => {
    if (loading) return
    const issue = reportPeriodError(filters) || (!filters.customer_id ? 'Select a customer before generating a statement.' : '')
    if (issue) { setFilterError(issue); return }
    setFilterError('')
    setError('')
    setLoading(true)
    setStatement(null)
    setApplied(null)
    const request = { customer_id: Number(filters.customer_id), from: filters.from, to: filters.to, currency: filters.currency }
    try {
      const response = await reportService.customerStatement(request)
      setStatement(readReport(response, 'statement'))
      setApplied(request)
    } catch (requestError) { setError(getErrorMessage(requestError, 'Unable to generate customer statement.')) }
    finally { setLoading(false) }
  }
  const downloadPdf = async () => {
    if (!statement || fileBusy) return
    setFileBusy('pdf')
    try {
      downloadFile(await getPdf(statement), `${statementFilename(statement)}.pdf`)
      toast('Customer statement PDF generated.', 'success', 'PDF ready')
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to generate PDF.'), 'error', 'PDF failed') }
    finally { setFileBusy('') }
  }
  const downloadExcel = async () => {
    if (!statement || fileBusy) return
    setFileBusy('excel')
    try {
      const XLSX = await import('xlsx')
      const book = XLSX.utils.book_new()
      const header = [
        ['Customer', statement.customer.name], ['From', statement.period.from], ['To', statement.period.to], ['Currency', statement.currency],
        ...['opening_balance', 'period_invoice_amount', 'period_credit_note_amount', 'period_payment_amount', 'closing_balance', 'outstanding_balance', 'overdue_amount']
          .map((key) => [key.replaceAll('_', ' '), Number(statement.summary[key] || 0)]),
      ]
      const sheet = XLSX.utils.aoa_to_sheet(header)
      sheet['!cols'] = [{ wch: 31 }, { wch: 35 }]
      XLSX.utils.book_append_sheet(book, sheet, 'Summary')
      const cols = REPORT_CSV_COLUMNS.statement
      const records = statement.transactions.map((record) => cols.map((column, i) => {
        const value = column.value(record)
        return i >= 3 ? Number(value || 0) : String(value ?? '')
      }))
      const rows = [cols.map((column) => column.label), ...records]
      const list = XLSX.utils.aoa_to_sheet(rows)
      list['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 17 }, { wch: 17 }, { wch: 21 }]
      XLSX.utils.book_append_sheet(book, list, 'Transactions')
      const file = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
      downloadFile(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${statementFilename(statement)}.xlsx`)
      toast('Customer statement Excel generated.', 'success', 'Excel ready')
    } catch (requestError) { toast(getErrorMessage(requestError, 'Unable to export statement.'), 'error', 'Export failed') }
    finally { setFileBusy('') }
  }
  const openSend = () => {
    if (!statement) return
    setSendValues({ recipient_email: statement.customer.email || '', recipient_name: statement.customer.name || '', message: '', delivery_mode: 'template_only' })
    setSendErrors({})
    setSendError('')
    setSendOpen(true)
  }
  const changeSend = (key, value) => {
    setSendValues((previous) => ({ ...previous, [key]: value }))
    if (sendErrors[key]) setSendErrors((previous) => ({ ...previous, [key]: '' }))
  }
  const sendStatement = async () => {
    if (!statement || !applied || sending) return
    const problems = statementSendErrors(sendValues)
    setSendErrors(problems)
    if (Object.keys(problems).length) return
    setSending(true)
    setSendError('')
    try {
      let attachment = null
      if (sendValues.delivery_mode === 'pdf_attachment') {
        const blob = await getPdf(statement)
        if (blob.size > FILE_SIZE_MAX) throw new Error('The PDF exceeds 4 MB. Choose email summary only or shorten the statement period.')
        attachment = {
          filename: `${statementFilename(statement)}.pdf`,
          mime_type: 'application/pdf', content_base64: await toBase64(blob),
        }
      }
      const response = await reportService.sendCustomerStatement({ ...applied,
        recipient_email: sendValues.recipient_email.trim(),
        recipient_name: sendValues.recipient_name.trim(), message: sendValues.message.trim(),
        delivery_mode: sendValues.delivery_mode, ...(attachment ? { pdf_attachment: attachment } : {}),
      })
      toast(response.data?.message || 'Statement email processed successfully.', 'success', 'Statement delivery')
      setSendOpen(false)
    } catch (requestError) { setSendError(getErrorMessage(requestError, 'Unable to send the statement.')) }
    finally { setSending(false) }
  }
  const columns = [
    { key: 'date', header: 'Date', cell: (r) => reportDate(r.transaction_date) },
    { key: 'ref', header: 'Reference', cell: (r) => {
      const targets = { invoice: canInvoice ? `/app/invoices/${r.link_id}` : '', credit_note: canCredit ? `/app/credit-notes/${r.link_id}` : '', payment: canPayment ? `/app/payments/${r.link_id}` : '' }
      const to = targets[r.type]
      return to ? <Link to={to} className="ref">{r.reference || '—'}</Link> : <strong className="ref">{r.reference || '—'}</strong>
    } },
    { key: 'description', header: 'Description', cell: (r) => r.description || '—' },
    { key: 'debit', header: 'Debit', align: 'right', cell: (r) => <span className="num">{reportMoney(r.debit, statement?.currency)}</span> },
    { key: 'credit', header: 'Credit', align: 'right', cell: (r) => <span className="num">{reportMoney(r.credit, statement?.currency)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', cell: (r) => <strong className="num">{reportMoney(r.running_balance, statement?.currency)}</strong> },
  ]
  const summary = statement?.summary
  const currency = statement?.currency || filters.currency
  const stats = summary ? [
    ['Opening balance', summary.opening_balance, WalletCards, 'blue'], ['Invoices', summary.period_invoice_amount, FilePlus2, 'teal'],
    ['Credit notes', summary.period_credit_note_amount, FileMinus2, 'amber'], ['Payments', summary.period_payment_amount, WalletCards, 'green'],
    ['Closing balance', summary.closing_balance, FileText, 'violet'],
  ] : []
  return <main className={styles.page}>
    <PageHeader eyebrow="Reports" title="Customer Statement" description="Generate a customer account statement from approved invoices, credit notes and payments, then export or email it professionally."
      actions={statement && <div className={styles.actions}>
        <Button size="sm" variant="secondary" icon={FileText} onClick={() => downloadReportCsv(statementFilename(statement), statement.transactions, REPORT_CSV_COLUMNS.statement)}>CSV</Button>
        <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={downloadExcel} loading={fileBusy === 'excel'} disabled={Boolean(fileBusy)}>Excel</Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={downloadPdf} loading={fileBusy === 'pdf'} disabled={Boolean(fileBusy)}>PDF</Button>
        {canSend && <Button size="sm" icon={Mail} onClick={openSend}>Email statement</Button>}
      </div>} />
    <section className={styles.filterBox} aria-label="Statement filters">
      <div className={styles.panelHeading}><div><h2>Select customer, period and currency</h2><p>Generate a statement for one customer and one currency.</p></div></div>
      <form onSubmit={(event) => { event.preventDefault(); generate() }}>
        <div className={styles.filterGrid}>
          <Select label="Customer" value={customer} loadOptions={searchCustomers} onChange={(option) => { setCustomer(option); change('customer_id', option?.value || '') }} placeholder="Search customers…" isClearable />
          <Select label="Period" value={filters.preset} options={REPORT_PERIOD_OPTIONS} onChange={choosePeriod} />
          <DatePicker label="From" value={filters.from} onChange={(date) => { setFilterError(''); setFilters((prev) => ({ ...prev, from: date, preset: 'custom' })) }} />
          <DatePicker label="To" value={filters.to} onChange={(date) => { setFilterError(''); setFilters((prev) => ({ ...prev, to: date, preset: 'custom' })) }} />
          <Select label="Currency" value={filters.currency} options={REPORT_CURRENCIES} onChange={(value) => change('currency', value)} />
          <Button type="submit" icon={RefreshCw} loading={loading} className={styles.apply}>Generate</Button>
        </div>
        {filterError && <p className={styles.errorText} role="alert">{filterError}</p>}
      </form>
    </section>
    {error && <Alert tone="danger" title="Statement unavailable">{error} <button type="button" className={styles.inlineAction} onClick={generate}>Try again</button></Alert>}
    {loading && <section className={styles.panel}><h2>Generating statement…</h2><p>Retrieving the customer's account activity.</p></section>}
    {!loading && !statement && !error && <section className={styles.emptyPanel}><FileText size={30} aria-hidden="true" /><h2>Generate a customer statement</h2><p>Choose a customer and period to see the running balance and download or email the statement.</p></section>}
    {statement && <>
      <section aria-label="Statement summary" className={styles.metrics}>
        {stats.map(([label, amount, Icon, tone]) => <StatCard key={label} label={label} value={reportMoney(amount, currency)} icon={Icon} tone={tone} />)}
      </section>
      <section className={styles.panel}>
        <div className={styles.statementLead}><div><p className={styles.eyebrow}>Customer account</p><h2>{statement.customer.name}</h2><p>{statement.customer.email || statement.customer.phone || 'No contact details saved'}</p>
          <p>From {reportDate(statement.period.from)} to {reportDate(statement.period.to)} · {currency}</p></div>
          <div><span>Current outstanding</span><strong className="num">{reportMoney(summary.outstanding_balance, currency)}</strong><small>{reportCount(summary.overdue_count)} overdue invoice(s) · {reportMoney(summary.overdue_amount, currency)} overdue</small></div>
        </div>
        <div className={styles.panelHeading}><div><h2>Account transactions</h2><p>Chronological debits, credits and running balance. Opening balance: {reportMoney(summary.opening_balance, currency)}.</p></div></div>
        <DataTable minWidth={825} rows={statement.transactions} columns={columns} rowKey={(r) => `${r.type}-${r.id}`}
          empty={<p className={styles.smallEmpty}>No transactions during the selected period. Opening and closing balances still apply.</p>} />
        <div className={styles.statementClosing}><span>Closing balance</span><strong className="num">{reportMoney(summary.closing_balance, currency)}</strong></div>
      </section>
    </>}
    <Alert tone="info" title="Accounting scope">This is an internal DigitalInvoice customer account statement, not a bank statement or evidence of NRS tax submission. Credits include approved credit notes and non-void customer payments.</Alert>
    <Modal open={sendOpen} onClose={() => !sending && setSendOpen(false)} busy={sending} size="lg" eyebrow="Customer statement" title="Email statement"
      description="Confirm the recipient and choose whether to include a PDF attachment."
      footer={<><Button variant="secondary" disabled={sending} onClick={() => setSendOpen(false)}>Cancel</Button><Button icon={Send} onClick={sendStatement} loading={sending}>Send statement</Button></>}>
      <div className={styles.sendForm}>
        {sendError && <Alert tone="danger" title="Statement not sent">{sendError}</Alert>}
        <Select label="Delivery option" value={sendValues.delivery_mode} options={methods} onChange={(value) => changeSend('delivery_mode', value)} />
        <div className={styles.twoFields}>
          <TextField label="Recipient email" type="email" value={sendValues.recipient_email} maxLength={190} error={sendErrors.recipient_email} onChange={(e) => changeSend('recipient_email', e.target.value)} />
          <TextField label="Recipient name (optional)" maxLength={120} value={sendValues.recipient_name} error={sendErrors.recipient_name} onChange={(e) => changeSend('recipient_name', e.target.value)} />
        </div>
        <Textarea label="Message (optional)" maxLength={1200} rows={3} value={sendValues.message} error={sendErrors.message} onChange={(e) => changeSend('message', e.target.value)} />
        <p className={styles.filterHint}>{sendValues.delivery_mode === 'pdf_attachment'
          ? 'A PDF statement will be generated locally and attached (maximum 4 MB).'
          : 'Only the branded customer statement summary will be emailed.'}</p>
      </div>
    </Modal>
  </main>
}
