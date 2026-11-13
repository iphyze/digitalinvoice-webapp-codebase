import { ChevronLeft, ChevronRight } from 'lucide-react'
import Select from '../forms/Select'
import styles from './Pagination.module.css'

const pagesToShow = (page, total) => {
  const candidates = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total))
  return [...candidates].sort((a, b) => a - b).flatMap((n, i, arr) => i && n - arr[i - 1] > 1 ? ['…', n] : [n])
}
export default function Pagination({ page = 1, limit = 10, total = 0, totalPages, onPageChange, onLimitChange, disabled = false, limits = [10, 20, 50], noun = 'customers' }) {
  const count = Math.max(1, Number(totalPages) || Math.ceil(total / limit) || 1)
  const current = Math.min(Math.max(1, Number(page) || 1), count)
  const first = total ? (current - 1) * limit + 1 : 0
  const last = Math.min(current * limit, total)
  return <nav className={styles.pagination} aria-label="Records pagination">
    <p>Showing <strong className="num">{first}–{last}</strong> of <strong className="num">{total}</strong> {noun}</p>
    <div className={styles.controls}>
      <div className={styles.limit}><span>Rows per page</span><Select className={styles.limitSelect} size="sm" value={limit} onChange={(next) => onLimitChange?.(Number(next))} options={limits.map((n) => ({ value: n, label: String(n) }))} isDisabled={disabled} isSearchable={false} aria-label="Rows per page" /></div>
      <button type="button" className={styles.navButton} disabled={disabled || current <= 1} onClick={() => onPageChange(current - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <div className={styles.pages}>{pagesToShow(current, count).map((n, i) => typeof n === 'number' ? <button key={n} type="button" aria-current={n === current ? 'page' : undefined} disabled={disabled} onClick={() => onPageChange(n)}>{n}</button> : <span key={`gap-${i}`}>…</span>)}</div>
      <button type="button" className={styles.navButton} disabled={disabled || current >= count} onClick={() => onPageChange(current + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  </nav>
}
