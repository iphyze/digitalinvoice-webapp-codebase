import { forwardRef } from 'react'
import styles from './DocumentSheet.module.css'
import NrsDocumentEvidence from '../nrs/NrsDocumentEvidence'

/**
 * On-screen document (approved "modern" template). Always white paper in both
 * themes: it's what prints and matches the PDF. Renders any model from documentModels.js.
 */
const DocumentSheet = forwardRef(function DocumentSheet({ model }, ref) {
  const { seller, party, table } = model
  return (
    <article ref={ref} className={styles.sheet} data-type={model.type}>
      <span className={styles.band} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.seller}>
          <span className={styles.logo}>{seller.logo ? <img src={seller.logo} alt={`${seller.name} logo`} /> : seller.initial}</span>
          <div>
            <p className={styles.eyebrow}>{model.eyebrow}</p>
            <h2 className={styles.sellerName}>{seller.name}</h2>
            {seller.lines.map((line) => <p key={line} className={styles.muted}>{line}</p>)}
          </div>
        </div>
        <div className={styles.number}>
          <p className={styles.label}>{model.title}</p>
          <h3 className="num">{model.number}</h3>
          <p className={styles.statuses}>
            {model.statuses.map((s) => <span key={s.text} data-tone={s.tone}>{s.text}</span>)}
          </p>
        </div>
      </header>

      <section className={styles.parties}>
        <div>
          <p className={styles.label}>{party.label}</p>
          <strong className={styles.partyName}>{party.name}</strong>
          {party.lines.map((line, i) => <p key={`${line}-${i}`} className={styles.muted}>{line}</p>)}
        </div>
        <dl className={styles.meta}>
          {model.meta.map((m) => (
            <div key={m.label}><dt>{m.label}</dt><dd className="num">{m.value}</dd></div>
          ))}
        </dl>
      </section>

      {model.highlight ? (
        <div className={styles.highlight}><span>{model.highlight.label}</span><strong className="num">{model.highlight.value}</strong></div>
      ) : null}

      {table.title ? (
        <div className={styles.tableTitle}><strong>{table.title}</strong><span>{table.subtitle}</span></div>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={`${styles.table} num`}>
          <thead>
            <tr>
              <th>{table.firstLabel || 'Description'}</th>
              {table.columns.map((c) => <th key={c.key} data-align={c.align}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.length ? table.rows.map((row, i) => (
              <tr key={`${row.title}-${i}`}>
                <td><strong>{row.title}</strong>{row.subtitle ? <small>{row.subtitle}</small> : null}</td>
                {table.columns.map((c) => <td key={c.key} data-align={c.align} data-strong={c.strong || undefined}>{row.cells[c.key]}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={table.columns.length + 1} className={styles.empty}>{table.empty || 'No lines on this document.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <section className={styles.footerGrid} data-totals={model.totals.length ? '' : undefined}>
        <div className={styles.blocks}>
          {model.blocks.map((b) => (
            <div key={b.label} className={b.card ? styles.card : undefined}>
              <p className={styles.label}>{b.label}</p>
              {b.title ? <strong>{b.title}</strong> : null}
              <p className={styles.muted}>{b.text}</p>
            </div>
          ))}
        </div>
        {model.totals.length ? (
          <dl className={`${styles.totals} num`}>
            {model.totals.map((t) => (
              <div key={t.label} data-emphasis={t.emphasis}><dt>{t.label}</dt><dd>{t.value}</dd></div>
            ))}
          </dl>
        ) : null}
      </section>

      {Object.hasOwn(model, 'nrsEvidence') ? <NrsDocumentEvidence evidence={model.nrsEvidence} /> : null}

      <footer className={styles.footer}>
        <p>{model.footer.message}</p>
        {model.footer.note ? <small>{model.footer.note}</small> : null}
      </footer>
    </article>
  )
})

export default DocumentSheet
