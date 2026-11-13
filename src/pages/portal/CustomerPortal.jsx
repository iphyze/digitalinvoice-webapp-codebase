import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, CircleCheck, Clock, Download, ExternalLink, LockKeyhole, Printer, ShieldCheck, TriangleAlert, CircleAlert, Info } from 'lucide-react'
import Button from '../../components/ui/Button'
import PageLoader from '../../components/ui/PageLoader'
import ThemeToggle from '../../components/ui/ThemeToggle'
import DocumentSheet from '../../components/documents/DocumentSheet'
import { DOCUMENT_TYPES, safeFileName } from '../../components/documents/documentModels'
import portalLinkService from '../../services/portalLinkService'
import useToastStore from '../../stores/useToastStore'
import { formatDate } from '../../utils/formatters'
import { getErrorMessage } from '../../utils/httpError'
import styles from './CustomerPortal.module.css'

/*
  Public customer portal (/portal/:token), approved Sample B: summary card +
  modern document. Behaviour and copy from the previous app: one shared
  document per link, views tracked once per browser session, sender branding,
  Print and Download PDF, "Secure link unavailable" state.
*/
const TONE_ICON = { success: CircleCheck, warning: Clock, danger: CircleAlert, neutral: Info }

// Scale the fixed-width A4 sheet to fit narrow screens. `ready` re-runs the
// measurement once the document exists (it isn't rendered while loading).
function useFitScale(ref, ready, base = 820) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ready) return undefined
    const update = () => setScale(Math.min(1, el.clientWidth / base))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, ready, base])
  return scale
}

export default function CustomerPortal() {
  const { token } = useParams()
  const showToast = useToastStore((s) => s.showToast)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const fitRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const storageKey = `digitalinvoice.portal.viewed.${token}`
        let shouldTrack = true
        try {
          shouldTrack = window.sessionStorage.getItem(storageKey) !== '1'
          if (shouldTrack) window.sessionStorage.setItem(storageKey, '1')
        } catch {
          shouldTrack = true
        }
        const response = await portalLinkService.access(token, { track: shouldTrack })
        setPayload(response.data?.data || null)
      } catch (requestError) {
        setError(getErrorMessage(requestError, 'This customer portal link is unavailable.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const config = DOCUMENT_TYPES[payload?.document_type] || null
  const portalDocument = config ? payload?.data?.[config.key] : null
  const organization = payload?.data?.organization || null
  const logo = organization?.logo_data_url || ''
  const businessName = organization?.trading_name || organization?.name || 'DigitalInvoice customer portal'
  const reference = useMemo(() => (config && portalDocument ? config.reference(portalDocument) : ''), [config, portalDocument])
  const model = useMemo(() => (config && portalDocument && organization ? config.build(portalDocument, organization, logo) : null), [config, portalDocument, organization, logo])
  const scale = useFitScale(fitRef, Boolean(model))

  useEffect(() => {
    if (model) document.title = `${config.title} ${reference} · ${businessName}`
  }, [model, config, reference, businessName])

  const printDocument = () => window.print()

  const downloadPdf = async () => {
    if (!model) return
    setPdfLoading(true)
    try {
      const [{ renderDocumentPdf }, { saveAs }] = await Promise.all([import('../../components/documents/pdf'), import('file-saver')])
      const blob = await renderDocumentPdf(model)
      saveAs(blob, `${safeFileName(reference)}.pdf`)
    } catch {
      showToast('The PDF could not be generated. Please try again.', 'error', 'Download failed')
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) return <PageLoader message="Opening secure customer portal..." />

  if (error || !model) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.secure}><ShieldCheck size={16} aria-hidden="true" />Secure customer portal</span>
          <ThemeToggle />
        </header>
        <main className={styles.errorWrap} id="main-content">
          <section className={`${styles.errorCard} fx-enter`}>
            <span className={styles.errorIcon}><TriangleAlert size={26} aria-hidden="true" /></span>
            <p className={styles.errorEyebrow}>Protected link</p>
            <h1>Secure link unavailable</h1>
            <p>{error || 'This customer portal link could not be opened.'}</p>
            <small>Please contact the business that sent this document to request a new link.</small>
          </section>
        </main>
      </div>
    )
  }

  const views = Number(payload.link?.access_count || 0)
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}>{logo ? <img src={logo} alt={`${businessName} logo`} /> : businessName.slice(0, 1)}</span>
          <div>
            <strong>{businessName}</strong>
            <span className={styles.secure}><ShieldCheck size={14} aria-hidden="true" />Secure customer portal</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className={styles.layout} id="main-content">
        <aside className={`${styles.summary} fx-enter`} aria-label="Document summary">
          <span className={styles.glow} aria-hidden="true" />
          <p className={styles.summaryEyebrow}><LockKeyhole size={14} aria-hidden="true" />Private document link</p>
          <p className={styles.from}>{config.title} from <strong>{businessName}</strong></p>
          <h1 className={`${styles.reference} num`}>{reference}</h1>
          <p className={styles.recipient}>{payload.document_label || config.title} shared securely for {model.recipient || 'customer review'}.</p>

          <div className={styles.amount}>
            <span>{model.summary.label}</span>
            <strong className="num">{model.summary.value}</strong>
            <small className="num">{model.summary.caption}</small>
          </div>

          <div className={styles.pills}>
            {model.statuses.map((st) => {
              const Icon = TONE_ICON[st.tone] || Info
              return <span key={st.text} data-tone={st.tone}><Icon size={14} aria-hidden="true" />{st.text}</span>
            })}
          </div>

          <div className={styles.actions}>
            <Button size="lg" block icon={Download} loading={pdfLoading} onClick={downloadPdf} className={styles.downloadBtn}>Download PDF</Button>
            <Button size="lg" block variant="ghost" icon={Printer} onClick={printDocument} className={styles.printBtn}>Print</Button>
          </div>

          <div className={styles.protected}>
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Protected link</strong>
              <span className="num"><CalendarClock size={13} aria-hidden="true" />Expires {formatDate(payload.link?.expires_at)} · {views} view{views === 1 ? '' : 's'}</span>
            </div>
          </div>
        </aside>

        <section className={styles.documentArea} ref={fitRef} aria-label={`${config.title} ${reference}`}>
          <div className={styles.printArea} style={{ zoom: scale }}>
            <DocumentSheet model={model} />
          </div>
          <p className={styles.footnote}>
            <ExternalLink size={14} aria-hidden="true" />
            This secure link only shows this shared document. It does not grant access to the sender’s DigitalInvoice workspace.
          </p>
        </section>
      </main>
    </div>
  )
}
