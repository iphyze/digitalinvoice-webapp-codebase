import { hasEntitledPermission } from '../../utils/entitlements'

/**
 * Read-only customer-portal link adapters.
 * The PHP list endpoint returns the newest 80 links, without their secret tokens.
 * Do not synthesize or derive a customer portal URL from list records.
 */
export const PORTAL_LINKS_MAX_RECENT = 80

export const PORTAL_LINK_TYPES = [
  { value: '', label: 'All documents' },
  { value: 'invoice', label: 'Invoices', permission: 'invoices.view', path: 'invoices' },
  { value: 'credit_note', label: 'Credit notes', permission: 'credit_notes.view', path: 'credit-notes' },
  { value: 'payment_receipt', label: 'Payment receipts', permission: 'payments.view', path: 'payments' },
  { value: 'proforma_invoice', label: 'Proforma invoices', permission: 'proformas.view', path: 'proforma-invoices' },
  { value: 'delivery_note', label: 'Delivery notes', permission: 'delivery_notes.view', path: 'delivery-notes' },
]

export const PORTAL_LINK_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
]

export const portalLinkDocumentLabel = (type) => ({
  invoice: 'Invoice',
  credit_note: 'Credit note',
  payment_receipt: 'Payment receipt',
  proforma_invoice: 'Proforma invoice',
  delivery_note: 'Delivery note',
}[type] || 'Document')

export const portalLinkStatus = (link = {}) => {
  // Flags are computed by PHP using its clock. Do not interpret its naive SQL
  // timestamp with a browser timezone or turn an absent flag into proof of expiry.
  if (link.is_revoked || link.revoked_at) return 'revoked'
  if (link.is_expired) return 'expired'
  return 'active'
}

export const portalLinkStatusTone = (status) => ({
  active: 'success',
  expired: 'warning',
  revoked: 'danger',
}[status] || 'neutral')

export function portalLinkCollection(response) {
  const records = response?.data?.data?.links
  if (!Array.isArray(records)) throw new Error('The secure links response was not recognised. Please try again.')
  return records.filter((record) => record && Number.isSafeInteger(Number(record.id)) && Number(record.id) > 0)
}

export function portalLinkMetrics(links = []) {
  const counts = { total: links.length, active: 0, expired: 0, revoked: 0, views: 0 }
  for (const link of links) {
    counts[portalLinkStatus(link)] += 1
    counts.views += Math.max(0, Number(link.access_count) || 0)
  }
  return counts
}

export function portalLinkFilter(links = [], { search = '', documentType = '', status = 'all' } = {}) {
  const term = String(search).trim().toLocaleLowerCase()
  return links.filter((link) => {
    if (documentType && link.document_type !== documentType) return false
    if (status !== 'all' && portalLinkStatus(link) !== status) return false
    if (!term) return true
    const searchText = [link.title, link.recipient_name, link.recipient_email,
      link.created_by_name, portalLinkDocumentLabel(link.document_type), link.id, link.document_id]
      .filter((entry) => entry != null)
      .join(' ').toLocaleLowerCase()
    return searchText.includes(term)
  })
}

export function portalLinkDocumentPath(link = {}, permissions = [], entitlements = null) {
  const definition = PORTAL_LINK_TYPES.find((type) => type.value === link.document_type)
  const id = Number(link.document_id)
  if (!definition?.permission || !Number.isSafeInteger(id) || id < 1) return null
  if (!Array.isArray(permissions) || (!permissions.includes('*') && !permissions.includes(definition.permission))) return null
  if (!hasEntitledPermission(entitlements, definition.permission)) return null
  return `/app/${definition.path}/${id}`
}
