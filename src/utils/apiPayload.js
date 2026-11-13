const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const responseRoot = (response) => response?.data ?? response ?? {};

/**
 * Traverse API response envelopes defensively. Some already-delivered routes use
 * `data.invoice`, while older responses may carry another wrapper. This keeps the
 * views compatible while the backend response contract is standardised.
 */
const findObject = (value, predicate, depth = 0, visited = new Set()) => {
  if (!isObject(value) || depth > 7 || visited.has(value)) return null;
  visited.add(value);
  if (predicate(value)) return value;

  const preferredKeys = ['data', 'payload', 'result', 'record', 'invoice', 'calculation'];
  for (const key of preferredKeys) {
    const match = findObject(value[key], predicate, depth + 1, visited);
    if (match) return match;
  }
  for (const nested of Object.values(value)) {
    const match = findObject(nested, predicate, depth + 1, visited);
    if (match) return match;
  }
  return null;
};

export const readApiData = (response) => findObject(
  responseRoot(response),
  (payload) => ['invoice', 'invoices', 'calculation', 'totals', 'pagination', 'invoice_id']
    .some((key) => Object.prototype.hasOwnProperty.call(payload, key)),
) || responseRoot(response);

export const readInvoiceRecord = (response) => findObject(
  responseRoot(response),
  (payload) => Object.prototype.hasOwnProperty.call(payload, 'id')
    && (Object.prototype.hasOwnProperty.call(payload, 'customer_id')
      || Object.prototype.hasOwnProperty.call(payload, 'invoice_date')
      || Object.prototype.hasOwnProperty.call(payload, 'status')),
);

export const readInvoiceId = (response) => {
  const invoice = readInvoiceRecord(response);
  if (invoice?.id) return Number(invoice.id);
  const payload = findObject(responseRoot(response), (value) => Boolean(value.invoice_id || value.invoiceId));
  return Number(payload?.invoice_id || payload?.invoiceId || 0);
};

export const readInvoiceCalculation = (response) => findObject(
  responseRoot(response),
  (payload) => isObject(payload.totals),
);

export const readInvoiceCollection = (response) => findObject(
  responseRoot(response),
  (payload) => Array.isArray(payload.invoices),
) || { invoices: [], pagination: { page: 1, limit: 10, total: 0, total_pages: 0 } };
