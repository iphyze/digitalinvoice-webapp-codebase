import { useState } from 'react'
import styles from './DataTable.module.css'

/** Reusable data table: desktop table + labelled mobile cards, skeletons, selection, sort and row actions.
 * columns: [{key, header, cell(row), mobileLabel?, width?, align?, sortable?}]
 * minWidth: table minimum width (px); wide tables scroll sideways instead of squeezing their text.
 */
export default function DataTable({ columns, rows = [], rowKey = 'id', loading = false, skeletonRows = 6,
  empty, actions, renderMobileCard, selected = [], onSelectionChange, onSort, sort, minWidth, className = '' }) {
  const [hovered, setHovered] = useState(null)
  const getKey = (row) => typeof rowKey === 'function' ? rowKey(row) : row[rowKey]
  const selectionEnabled = typeof onSelectionChange === 'function'
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(getKey(row)))
  const toggle = (id) => onSelectionChange?.(selected.includes(id) ? selected.filter((key) => key !== id) : [...selected, id])
  const placeholder = <span className={styles.skeleton} aria-hidden="true" />
  const desktopCell = (column, row) => {
    if (column.cell) return column.cell(row)
    const value = row[column.key] ?? '—'
    return <span className={styles.truncated} title={String(value)}>{value}</span>
  }
  if (!loading && !rows.length) return <div className={`${styles.tableCard} ${className}`}>{empty || <p className={styles.empty}>No records found.</p>}</div>
  return <div className={`${styles.tableCard} ${className}`} aria-busy={loading}>
    <div className={styles.scroller}>
      <table className={styles.table} style={minWidth ? { minWidth } : undefined}>
        <thead><tr>
          {selectionEnabled && <th className={styles.check}><input type="checkbox" checked={allSelected} onChange={() => onSelectionChange(allSelected ? [] : rows.map(getKey))} aria-label="Select all rows" /></th>}
          {columns.map((column) => <th key={column.key} style={column.width ? { width: column.width } : undefined} data-align={column.align || 'left'}>
            {column.sortable && onSort ? <button type="button" className={styles.sort} onClick={() => onSort(column.key)} aria-label={`Sort by ${column.header}`}>{column.header}{sort?.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button> : column.header}
          </th>)}
          {actions && <th className={styles.actionHeading}>Actions</th>}
        </tr></thead>
        <tbody>
          {loading ? Array.from({ length: skeletonRows }, (_, i) => <tr key={`skeleton-${i}`} className={styles.skeletonRow}>{selectionEnabled && <td>{placeholder}</td>}{columns.map((c) => <td key={c.key}>{placeholder}</td>)}{actions && <td>{placeholder}</td>}</tr>)
            : rows.map((row) => <tr key={getKey(row)} onMouseEnter={() => setHovered(getKey(row))} onMouseLeave={() => setHovered(null)} data-hovered={hovered === getKey(row) || undefined}>
              {selectionEnabled && <td className={styles.check}><input type="checkbox" aria-label={`Select row ${getKey(row)}`} checked={selected.includes(getKey(row))} onChange={() => toggle(getKey(row))} /></td>}
              {columns.map((column) => <td key={column.key} data-align={column.align || 'left'}>{desktopCell(column, row)}</td>)}
              {actions && <td className={styles.actions}>{actions(row)}</td>}
            </tr>)}
        </tbody>
      </table>
    </div>
    <div className={styles.mobileCards}>
      {loading ? Array.from({ length: 4 }, (_, i) => <div className={styles.mobileCard} key={i}>{placeholder}{placeholder}{placeholder}</div>) : rows.map((row) => <article className={styles.mobileCard} key={getKey(row)}>
        {renderMobileCard ? renderMobileCard(row) : <>{selectionEnabled && <label className={styles.mobileSelect}><input type="checkbox" checked={selected.includes(getKey(row))} onChange={() => toggle(getKey(row))} /> Select</label>}
        {columns.map((column, index) => <div key={column.key} className={index === 0 ? styles.mobileLead : styles.mobileField}>
          {index !== 0 && <span className={styles.mobileLabel}>{column.mobileLabel || column.header}</span>}
          <div className={styles.mobileValue}>{column.cell ? column.cell(row) : (row[column.key] ?? '—')}</div>
        </div>)}
        {actions && <div className={styles.mobileActions}>{actions(row)}</div>}</>}
      </article>)}
    </div>
  </div>
}
