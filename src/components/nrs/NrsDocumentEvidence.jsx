import { QRCodeSVG } from 'qrcode.react'
import { hasProductionNrsEvidence } from './nrsEvidence'
import styles from './NrsDocumentEvidence.module.css'

/** NRS identifiers are never inferred from an invoice or a local dry-run job. */
export default function NrsDocumentEvidence({ evidence }) {
  const confirmed = hasProductionNrsEvidence(evidence)

  return (
    <section className={styles.panel} aria-label="NRS submission status">
      {confirmed ? (
        <>
          <div className={styles.details}>
            <p className={styles.heading}>NRS e-invoice evidence</p>
            <dl className={styles.identifiers}>
              <div><dt>IRN</dt><dd className="num">{evidence.irn}</dd></div>
              <div><dt>CSID</dt><dd className="num">{evidence.csid}</dd></div>
              <div><dt>Status</dt><dd>Confirmed by NRS</dd></div>
            </dl>
          </div>
          <div className={styles.qr} role="img" aria-label="NRS confirmation QR code">
            <QRCodeSVG value={evidence.qr_payload} size={108} level="M" marginSize={4} />
          </div>
        </>
      ) : (
        <p className={styles.notSubmitted}>Not yet submitted to NRS</p>
      )}
    </section>
  )
}
