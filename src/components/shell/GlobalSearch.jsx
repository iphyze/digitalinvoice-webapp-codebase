import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, ShieldCheck } from 'lucide-react'
import Modal from '../overlays/Modal'
import globalSearchService from '../../services/globalSearchService'
import { getErrorMessage } from '../../utils/httpError'
import styles from './GlobalSearch.module.css'

export default function GlobalSearch({ open, scope = 'workspace', onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const platform = scope === 'platform'
  useEffect(() => {
    if (!open) { setQuery(''); setResult(null); setError(''); setLoading(false); requestId.current += 1 }
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const trimmed = query.trim()
    requestId.current += 1
    const id = requestId.current
    setError('')
    if (trimmed.length < 2) { setResult(null); setLoading(false); return undefined }
    setLoading(true)
    setResult(null)
    const timer = setTimeout(async () => {
      try {
        const response = platform
          ? await globalSearchService.platform({ q: trimmed, limit: 5 })
          : await globalSearchService.workspace({ q: trimmed, limit: 5 })
        if (id === requestId.current) setResult(response.data?.data || { groups: [], total: 0 })
      } catch (e) {
        if (id === requestId.current) { setResult(null); setError(getErrorMessage(e, 'Unable to complete global search.')) }
      } finally { if (id === requestId.current) setLoading(false) }
    }, 260)
    return () => clearTimeout(timer)
  }, [open, query, platform])
  const select = (path) => { if (!path) return; onClose(); navigate(path) }
  return <Modal open={open} onClose={onClose} size="lg"
    eyebrow={platform ? 'Owner command search' : 'Workspace command search'}
    title={platform ? 'Search owner console' : 'Search workspace'}
    description={platform ? 'Find clients, subscriptions, plans and owner-console users from one command centre.' : 'Find invoices, customers, payments and sales documents in this workspace.'}>
    <div className={styles.searchField}><Search size={20} aria-hidden="true"/>
      <input data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off"
        aria-label="Search records" placeholder={platform ? 'Search clients, subscriptions, plans, platform users...' : 'Search invoices, customers, payments, proformas...'} />
      {loading && <span className={styles.loading}>Searching…</span>}
    </div>
    <div className={styles.results} aria-live="polite">
      {query.trim().length < 2 ? <div className={styles.hint}><ShieldCheck size={21}/><div><strong>Type at least 2 characters to begin.</strong>
        <p>{platform ? 'Try a client name, owner email, plan code or subscription reference.' : 'Try an invoice number, customer name, receipt number or document reference.'}</p></div></div>
        : error ? <p className={styles.empty} role="alert">{error}</p>
          : loading && !result ? <p className={styles.empty}>Searching records…</p>
            : !loading && result?.total === 0 ? <p className={styles.empty}>No matching records. Try a different keyword or check the spelling.</p>
              : (result?.groups || []).map((group) => <section key={group.key} className={styles.group}>
                <h3>{group.title} <small>{group.count} found</small></h3>
                {(group.items || []).map((item) => <button type="button" key={`${group.key}-${item.id}-${item.path}`} onClick={() => select(item.path)}>
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small>{item.meta && <em>{item.meta}</em>}</span>
                  {item.badge && <span className={styles.badge}>{item.badge}</span>}<ArrowRight size={16}/>
                </button>)}
              </section>)}
    </div>
  </Modal>
}
