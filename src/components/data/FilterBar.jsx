import { useEffect, useState } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import Select from '../forms/Select'
import styles from './FilterBar.module.css'

/** URL query synchronisation is owned by the page; FilterBar debounces search input. */
export default function FilterBar({ search = '', onSearchChange, filters = [], chips = [], onReset, busy = false, debounceMs = 360,
  placeholder = 'Search...', className = '' }) {
  const [draft, setDraft] = useState(search)
  useEffect(() => setDraft(search), [search])
  useEffect(() => {
    if (draft === search) return undefined
    const timeout = window.setTimeout(() => onSearchChange?.(draft), debounceMs)
    return () => window.clearTimeout(timeout)
  }, [draft, search, debounceMs, onSearchChange])
  return <div className={`${styles.bar} ${className}`}>
    <div className={styles.controls}>
      <label className={styles.search}><Search size={17} aria-hidden="true" />
        <input type="search" value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} aria-label="Search records" autoComplete="off" />
      </label>
      {filters.map((filter) => <Select key={filter.key} className={styles.select} size="md" value={filter.value} options={filter.options} onChange={filter.onChange} placeholder={filter.placeholder} icon={filter.icon} />)}
      {busy && <span className={styles.updating} role="status">Updating…</span>}
    </div>
    {chips.length ? <div className={styles.chips} aria-label="Active filters">{chips.map((chip) => <button type="button" key={chip.key} className={styles.chip} onClick={chip.onRemove}>{chip.label}<X size={13} aria-hidden="true" /><span className={styles.srOnly}>Remove filter</span></button>)}<button type="button" className={styles.reset} onClick={() => { setDraft(''); onReset?.() }}><RotateCcw size={13} /> Reset filters</button></div> : null}
  </div>
}
