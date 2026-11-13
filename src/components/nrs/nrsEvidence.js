/**
 * Only verified production evidence from the authenticated NRS backend may be
 * presented as official. The backend sets `verified: true` only for a confirmed
 * production record with `verified_at`; the client also requires the timestamp.
 * A dry-run, sandbox record or partial payload must never generate an NRS QR.
 */
export const hasProductionNrsEvidence = (evidence) => Boolean(
  evidence && evidence.verified === true && evidence.environment === 'production'
  && typeof evidence.verified_at === 'string' && evidence.verified_at.trim()
  && typeof evidence.irn === 'string' && evidence.irn.trim()
  && typeof evidence.csid === 'string' && evidence.csid.trim()
  && typeof evidence.qr_payload === 'string' && evidence.qr_payload.trim(),
);
