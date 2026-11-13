import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardMoney } from './dashboardModel'
import styles from './Dashboard.module.css'

const compact = (value) => new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0)

function MoneyTooltip({ active, label, payload, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} className={styles.tooltipRow}>
          <span>{item.name}</span>
          <strong className="num">{dashboardMoney(item.value, currency)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardTrendChart({ points, currency }) {
  return (
    <div className={styles.chart} role="img" aria-label={`Trend chart of approved invoice values and payments received in ${currency}. A data table follows for screen readers.`}>
      <ResponsiveContainer width="100%" height={290}>
        <ComposedChart data={points} margin={{ top: 15, right: 10, bottom: 0, left: 1 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis tickFormatter={compact} tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
          <Tooltip content={<MoneyTooltip currency={currency} />} />
          <Area type="monotone" dataKey="invoiced" name="Approved invoices" stroke="var(--color-primary)" fill="var(--color-primary-soft)" fillOpacity={0.75} strokeWidth={2.4} />
          <Line type="monotone" dataKey="collected" name="Payments received" stroke="var(--color-success)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
