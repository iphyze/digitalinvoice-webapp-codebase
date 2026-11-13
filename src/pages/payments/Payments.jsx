import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, CircleCheck, CircleDashed, Eye, Plus, ReceiptText, WalletCards, XCircle } from 'lucide-react'
import PageHeader from '../../components/shell/PageHeader'
import SummaryStat from '../../components/data/SummaryStat'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/data/DataTable'
import FilterBar from '../../components/data/FilterBar'
import Pagination from '../../components/data/Pagination'
import paymentService from '../../services/paymentService'
import useAuthStore from '../../stores/useAuthStore'
import useToastStore from '../../stores/useToastStore'
import { hasPermission } from '../../utils/permissions'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import { PAYMENT_METHODS, PAYMENT_STATUSES, paymentCollection, paymentMethodText, paymentMoney, paymentReference, paymentStatusLabel, paymentStatusTone } from './paymentModel'
import PaymentRecordDialog from './PaymentRecordDialog'
import styles from '../invoices/Invoices.module.css'

const pageNumber = (input) => Math.max(1, Math.floor(Number(input) || 1))
const validStatus = (value) => PAYMENT_STATUSES.some((item) => item.value === value) ? value : 'all'
const validMethod = (value) => PAYMENT_METHODS.some((item) => item.value === value) ? value : ''

export default function Payments() {
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.permissions)
  const toast = useToastStore((state) => state.showToast)
  const canRecord = hasPermission(permissions, 'payments.record')
  const [query, setQuery] = useSearchParams()
  const search = query.get('search') || ''
  const status = validStatus(query.get('status'))
  const method = validMethod(query.get('method'))
  const page = pageNumber(query.get('page'))
  const limit = [10, 20, 50].includes(Number(query.get('limit'))) ? Number(query.get('limit')) : 10
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [recordOpen, setRecordOpen] = useState(false)
  const change = useCallback((updates) => setQuery((previous) => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '' || (key === 'status' && value === 'all') || (key === 'page' && Number(value) === 1) || (key === 'limit' && Number(value) === 10)) next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }), [setQuery])
  useEffect(() => {
    let active = true
    setBusy(true)
    setError('')
    paymentService.list({ search: search.trim() || undefined, status, method: method || undefined, page, limit })
      .then((response) => {
        if (!active) return
        const data = paymentCollection(response)
        setRecords(data.payments)
        setPagination(data.pagination)
      }).catch((requestError) => {
        if (!active) return
        setError(getErrorMessage(requestError, 'Unable to load payments.'))
        setRecords([])
      }).finally(() => { if (active) { setLoading(false); setBusy(false) } })
    return () => { active = false }
  }, [search, status, method, page, limit, revision])
  const counters = useMemo(() => ({
    received: records.filter((payment) => payment.status === 'received').length,
    partial: records.filter((payment) => payment.status === 'partially_allocated').length,
    allocated: records.filter((payment) => payment.status === 'allocated').length,
    void: records.filter((payment) => payment.status === 'void').length,
  }), [records])
  const stats = [
    { label: 'Total receipts', value: Number(pagination.total) || 0, icon: ReceiptText, tone: 'blue' },
    { label: 'Received on this page', value: counters.received, icon: Banknote, tone: 'teal' },
    { label: 'Partially allocated on page', value: counters.partial, icon: CircleDashed, tone: 'amber' },
    { label: 'Fully allocated on page', value: counters.allocated, icon: CircleCheck, tone: 'green' },
    { label: 'Voided on this page', value: counters.void, icon: XCircle, tone: 'violet' },
  ]
  const badge = (record) => <StatusBadge status={record.status} tone={paymentStatusTone(record.status)} label={paymentStatusLabel(record.status)} />
  const actions = (record) => <div className={styles.rowActions}><Link className={`${styles.iconAction} ${styles.viewAction}`} to={`/app/payments/${record.id}`} title="View payment" aria-label={`View ${paymentReference(record)}`}><Eye size={16} /></Link></div>
  const columns = [
    { key: 'receipt', header: 'Receipt', width: '19%', cell: (record) => <div className={styles.twoLines}><Link className={`${styles.invoiceLink} num ref`} to={`/app/payments/${record.id}`}>{paymentReference(record)}</Link><small>{record.reference || 'No reference'}</small></div> },
    { key: 'customer', header: 'Customer', width: '18%', cell: (record) => <strong>{record.customer_name_snapshot || 'Unknown customer'}</strong> },
    { key: 'date', header: 'Payment date', width: '12%', cell: (record) => <span className="num">{formatDate(record.payment_date)}</span> },
    { key: 'method', header: 'Method', width: '13%', cell: paymentMethodText },
    { key: 'amount', header: 'Amount received', width: '15%', align: 'right', cell: (record) => <strong className="num">{paymentMoney(record.amount, record.currency)}</strong> },
    { key: 'unallocated', header: 'Unallocated', width: '13%', align: 'right', cell: (record) => <span className="num">{paymentMoney(record.unallocated_amount, record.currency)}</span> },
    { key: 'status', header: 'Status', width: '10%', cell: badge },
  ]
  const reset = () => change({ search: '', status: 'all', method: '', page: 1 })
  const chips = [
    ...(search ? [{ key: 'search', label: `Search: “${search}”`, onRemove: () => change({ search: '', page: 1 }) }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: paymentStatusLabel(status), onRemove: () => change({ status: 'all', page: 1 }) }] : []),
    ...(method ? [{ key: 'method', label: PAYMENT_METHODS.find((entry) => entry.value === method)?.label || method, onRemove: () => change({ method: '', page: 1 }) }] : []),
  ]
  const empty = <div className={styles.empty}><WalletCards size={30} aria-hidden="true" /><h2>{chips.length ? 'No matching payments' : 'No customer payments yet'}</h2>
    <p>{chips.length ? 'Try adjusting your filters.' : 'Record money received from customers and allocate receipts against approved invoices.'}</p>
    {!chips.length && canRecord && <Button icon={Plus} onClick={() => setRecordOpen(true)}>Record payment</Button>}
  </div>
  return <div className={`${styles.page} fx-enter`}>
    <PageHeader eyebrow="Receivables" title="Payments" description="Track customer receipts, invoice allocations and outstanding balances."
      actions={canRecord && <Button icon={Plus} onClick={() => setRecordOpen(true)}>Record payment</Button>} />
    <div className={styles.stats}>{stats.map(({ label, value, icon, tone }) => (
      <SummaryStat key={label} icon={icon} label={label} value={loading ? '—' : Number(value).toLocaleString('en-NG')} tone={tone} />
    ))}</div>
    <FilterBar search={search} onSearchChange={(value) => change({ search: value, page: 1 })} busy={busy && !loading}
      placeholder="Search receipt number, reference or customer..."
      filters={[{ key: 'status', value: status, onChange: (value) => change({ status: value, page: 1 }), options: PAYMENT_STATUSES },
        { key: 'method', value: method, onChange: (value) => change({ method: value, page: 1 }), options: PAYMENT_METHODS }]}
      chips={chips} onReset={reset} />
    {error ? <div className={styles.empty} role="alert"><h2>Payments unavailable</h2><p>{error}</p><Button onClick={() => setRevision((current) => current + 1)}>Try again</Button></div> : <>
      <DataTable columns={columns} minWidth={1040} rows={records} loading={loading} empty={empty} actions={actions}
        renderMobileCard={(record) => <>
          <div className={styles.mobileTop}><div className={styles.mobileInvoice}><Link className="num ref" to={`/app/payments/${record.id}`}>{paymentReference(record)}</Link><small>{record.customer_name_snapshot || 'Customer'}</small></div>{badge(record)}</div>
          <div className={styles.mobileRow}><strong className="num">{paymentMoney(record.amount, record.currency)}</strong><span>{formatDate(record.payment_date)}</span></div>
          <div className={styles.mobileChips}><span>{paymentMethodText(record)}</span><span className="num">Unallocated: {paymentMoney(record.unallocated_amount, record.currency)}</span></div>
          <div className={styles.mobileFooter}><span>{record.reference || 'No reference'}</span>{actions(record)}</div>
        </>} />
      {!loading && records.length > 0 && <Pagination noun="payments" page={page} limit={limit} total={Number(pagination.total) || 0}
        totalPages={Number(pagination.total_pages) || undefined} disabled={busy} onPageChange={(value) => change({ page: value })} onLimitChange={(value) => change({ page: 1, limit: value })} />}
    </>}
    {canRecord && <PaymentRecordDialog open={recordOpen} onClose={() => setRecordOpen(false)} onSaved={(payment) => {
      setRecordOpen(false)
      toast('Payment recorded successfully.', 'success', 'Receipt created')
      navigate(`/app/payments/${payment.id}`)
    }} />}
  </div>
}
