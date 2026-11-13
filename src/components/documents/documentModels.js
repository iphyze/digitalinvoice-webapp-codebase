/*
  Document models: one description per document type, rendered by both
  DocumentSheet (screen) and pdf.jsx (PDF), so they always match.
  Fields, labels, fallbacks and conditions are carried over from the
  previous app's InvoiceDocument, CreditNoteDocument, PaymentReceiptDocument
  and SupportDocumentPreview.

  model = {
    type, eyebrow, title, number, statuses: [{ text, tone }],
    seller: { name, initial, logo, lines[] },
    party: { label, name, lines[] },
    meta: [{ label, value }],
    highlight?: { label, value },                  // receipt: amount received
    table: { title?, subtitle?, columns: [{ key, label, align }], rows: [{ title, subtitle, cells }], empty? },
    blocks: [{ label, title?, text, card? }],
    totals: [{ label, value, emphasis? 'grand' | 'due' }],
    footer: { message, note },
    summary: { label, value, caption },           // portal summary card
    recipient,                                    // "shared securely for …"
  }
*/
import { formatCurrency, formatDate } from '../../utils/formatters'
import {
  creditNoteReasonLabel, creditNoteReferenceLabel, creditNoteStatusLabel, invoiceStatusLabel,
  nrsStatusLabel, paymentMethodLabel, paymentStatusLabel,
} from './labels'

const clean = (value) => (value ? String(value) : '—')
const join = (...values) => values.filter(Boolean).join(' · ')
const businessName = (org, fallback = 'Business name') => org?.trading_name || org?.name || fallback
const toneFor = (status) => {
  const v = String(status || '').toLowerCase()
  if (['approved', 'paid', 'received', 'completed', 'delivered', 'accepted', 'active'].includes(v)) return 'success'
  if (['pending_approval', 'partially_paid', 'pending', 'sent'].includes(v)) return 'warning'
  if (['void', 'rejected', 'failed', 'reversed', 'cancelled', 'expired'].includes(v)) return 'danger'
  return 'neutral'
}

const seller = (org, logo, withTin = false) => ({
  name: businessName(org),
  initial: businessName(org).slice(0, 1) || 'D',
  logo: logo || '',
  lines: [
    org?.address || 'Business address not supplied',
    join(org?.business_email, org?.phone) || 'Contact details not supplied',
    withTin && org?.tax_identification_number ? `TIN: ${org.tax_identification_number}` : '',
  ].filter(Boolean),
})

/* ---- Invoice ---- */
const invoiceModel = (invoice, org, logo) => {
  const currency = invoice.currency
  const money = (v) => formatCurrency(v, currency)
  const number = invoice.invoice_number || `Draft #${invoice.id}`
  const outstanding = invoice.balance_due ?? invoice.outstanding_amount ?? (Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0))
  // As in the previous app: line discount always shown, invoice discount only when present
  const hasDiscount = Number(invoice.line_discount_amount || 0) > 0 || Number(invoice.invoice_discount_amount || 0) > 0
  const lineDiscount = (line) => Number(line?.line_discount_amount || 0) + Number(line?.invoice_discount_allocated_amount || 0)
  return {
    type: 'invoice',
    nrsEvidence: invoice.nrs_evidence ?? null,
    eyebrow: 'Tax invoice',
    title: 'Invoice',
    number,
    statuses: [
      { text: invoiceStatusLabel(invoice.status), tone: toneFor(invoice.status) },
      { text: paymentStatusLabel(invoice.payment_status || 'not_applicable'), tone: toneFor(invoice.payment_status) },
    ],
    seller: seller(org, logo),
    party: {
      label: 'Bill to',
      name: invoice.customer_name_snapshot,
      lines: [
        invoice.customer_address_snapshot || 'Customer address not supplied',
        join(invoice.customer_email_snapshot, invoice.customer_phone_snapshot) || 'No contact details supplied',
        invoice.customer_tin_snapshot ? `TIN: ${invoice.customer_tin_snapshot}` : '',
      ].filter(Boolean),
    },
    meta: [
      { label: 'Invoice date', value: formatDate(invoice.invoice_date) },
      { label: 'Due date', value: formatDate(invoice.due_date) },
      { label: 'Currency', value: currency },
      { label: 'NRS status', value: nrsStatusLabel(invoice.nrs_submission_status) },
      invoice.reference ? { label: 'Reference', value: invoice.reference } : null,
      invoice.purchase_order_number ? { label: 'PO number', value: invoice.purchase_order_number } : null,
    ].filter(Boolean),
    table: {
      columns: [
        { key: 'qty', label: 'Qty', align: 'right' },
        { key: 'unit', label: 'Unit price', align: 'right' },
        { key: 'discount', label: 'Discount', align: 'right' },
        { key: 'vat', label: 'VAT', align: 'right' },
        { key: 'total', label: 'Total', align: 'right', strong: true },
      ],
      rows: (invoice.lines || invoice.items || []).map((line) => ({
        title: line.item_name_snapshot,
        subtitle: line.item_description_snapshot || line.item_code_snapshot || 'Invoice item',
        cells: {
          qty: `${Number(line.quantity || 0).toLocaleString()} ${line.unit_code_snapshot || ''}`.trim(),
          unit: money(line.unit_price),
          discount: money(lineDiscount(line)),
          vat: money(line.tax_amount),
          total: money(line.total_amount),
        },
      })),
    },
    blocks: [
      { label: 'Payment account', title: clean(invoice.bank_name_snapshot), text: `${clean(invoice.bank_account_name_snapshot)} · ${clean(invoice.bank_account_number_snapshot)}`, card: true },
      { label: 'Payment instructions', text: invoice.payment_instructions || 'No specific payment instruction was added to this invoice.' },
      invoice.notes ? { label: 'Notes', text: invoice.notes } : null,
    ].filter(Boolean),
    totals: [
      { label: 'Subtotal', value: money(invoice.subtotal_amount) },
      { label: 'Line discount', value: `- ${money(invoice.line_discount_amount)}` },
      hasDiscount ? { label: 'Invoice discount', value: `- ${money(invoice.invoice_discount_amount)}` } : null,
      { label: 'Net amount', value: money(invoice.net_amount) },
      { label: 'VAT / Tax', value: money(invoice.tax_amount) },
      { label: 'Total', value: money(invoice.total_amount), emphasis: 'grand' },
      { label: 'Amount paid', value: money(invoice.amount_paid) },
      { label: 'Balance due', value: money(outstanding), emphasis: 'due' },
    ].filter(Boolean),
    footer: {
      message: invoice.footer_note || 'Thank you for doing business with us.',
      note: 'Only confirmed production NRS evidence, when available, is shown on this document.',
    },
    summary: { label: 'Balance due', value: money(outstanding), caption: `of ${money(invoice.total_amount)} · due ${formatDate(invoice.due_date)}` },
    recipient: invoice.customer_name_snapshot,
  }
}

/* ---- Credit note ---- */
const creditNoteModel = (note, org, logo) => {
  const currency = note.currency
  const money = (v) => formatCurrency(v, currency)
  const sourceInvoice = note.invoice_number || `Invoice #${note.invoice_id}`
  const hasDiscount = Number(note.line_discount_amount || 0) > 0 || Number(note.invoice_discount_amount || 0) > 0
  return {
    type: 'credit_note',
    nrsEvidence: note.nrs_evidence ?? null,
    eyebrow: 'Credit note',
    title: 'Credit note',
    number: creditNoteReferenceLabel(note),
    statuses: [
      { text: creditNoteStatusLabel(note.status), tone: toneFor(note.status) },
      { text: creditNoteReasonLabel(note.reason_category), tone: 'neutral' },
    ],
    seller: seller(org, logo),
    party: {
      label: 'Credit to',
      name: note.customer_name_snapshot,
      lines: [
        note.customer_address_snapshot || 'Customer address not supplied',
        join(note.customer_email_snapshot, note.customer_phone_snapshot) || 'No contact details supplied',
        note.customer_tin_snapshot ? `TIN: ${note.customer_tin_snapshot}` : '',
      ].filter(Boolean),
    },
    meta: [
      { label: 'Credit note date', value: formatDate(note.credit_note_date) },
      { label: 'Source invoice', value: sourceInvoice },
      { label: 'Invoice date', value: formatDate(note.invoice_date) },
      { label: 'Currency', value: currency },
      { label: 'Reason', value: creditNoteReasonLabel(note.reason_category) },
      note.external_reference ? { label: 'Reference', value: note.external_reference } : null,
    ].filter(Boolean),
    table: {
      columns: [
        { key: 'qty', label: 'Qty', align: 'right' },
        { key: 'unit', label: 'Unit price', align: 'right' },
        { key: 'vat', label: 'VAT', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right', strong: true },
      ],
      rows: (note.lines || note.items || []).map((line) => ({
        title: line.item_name_snapshot,
        subtitle: line.item_description_snapshot || line.item_code_snapshot || 'Credited item',
        cells: {
          qty: `${Number(line.quantity || 0).toLocaleString()} ${line.unit_code_snapshot || ''}`.trim(),
          unit: money(line.unit_price),
          vat: money(line.tax_amount),
          credit: `- ${money(line.total_amount)}`,
        },
      })),
    },
    blocks: [
      { label: 'Credit reason', title: creditNoteReasonLabel(note.reason_category), text: note.reason || 'Credit adjustment', card: true },
      { label: 'Source invoice', title: sourceInvoice, text: `Original invoice total: ${money(note.invoice_total_amount)}` },
      note.notes ? { label: 'Notes', text: note.notes } : null,
    ].filter(Boolean),
    totals: [
      { label: 'Subtotal', value: money(note.subtotal_amount) },
      hasDiscount ? { label: 'Line discount', value: `- ${money(note.line_discount_amount)}` } : null,
      hasDiscount ? { label: 'Invoice discount', value: `- ${money(note.invoice_discount_amount)}` } : null,
      { label: 'Net amount', value: money(note.net_amount) },
      { label: 'VAT / Tax reversed', value: money(note.tax_amount) },
      { label: 'Total credit', value: `- ${money(note.total_amount)}`, emphasis: 'due' },
    ].filter(Boolean),
    footer: {
      message: `This credit note reduces the customer balance for ${clean(sourceInvoice)}.`,
      note: 'Please match this credit note against the source invoice in your records. It has been generated from the approved credit adjustment recorded in DigitalInvoice.',
    },
    summary: { label: 'Total credit', value: `- ${money(note.total_amount)}`, caption: `Against ${sourceInvoice}` },
    recipient: note.customer_name_snapshot,
  }
}

/* ---- Payment receipt ---- */
const receiptModel = (payment, org, logo) => {
  const currency = payment?.currency
  const money = (v) => formatCurrency(v, currency)
  const allocations = (payment?.allocations || []).filter((row) => !row.reversed_at)
  const status = payment?.status ? payment.status.replace(/_/g, ' ') : 'received'
  return {
    type: 'payment',
    nrsEvidence: payment?.nrs_evidence ?? null,
    eyebrow: 'Payment receipt',
    title: 'Receipt',
    number: payment?.receipt_number || `Receipt #${payment?.id || ''}`,
    statuses: [{ text: status.charAt(0).toUpperCase() + status.slice(1), tone: toneFor(payment?.status || 'received') }],
    seller: seller(org, logo, true),
    party: {
      label: 'Received from',
      name: payment?.customer_name_snapshot || 'Customer',
      lines: [payment?.customer_email_snapshot || 'Customer email not supplied', payment?.payer_name ? `Payer: ${payment.payer_name}` : ''].filter(Boolean),
    },
    meta: [
      { label: 'Payment date', value: formatDate(payment?.payment_date) },
      { label: 'Method', value: paymentMethodLabel(payment?.payment_method) },
      { label: 'Currency', value: currency || 'NGN' },
      { label: 'Reference', value: payment?.reference || '—' },
    ],
    highlight: { label: 'Amount received', value: money(payment?.amount) },
    table: {
      title: 'Invoice allocations',
      subtitle: `${allocations.length} active allocation${allocations.length === 1 ? '' : 's'}`,
      firstLabel: 'Invoice',
      columns: [
        { key: 'invoiceDate', label: 'Invoice date' },
        { key: 'allocatedOn', label: 'Allocated on' },
        { key: 'amount', label: 'Amount', align: 'right', strong: true },
      ],
      rows: allocations.map((a) => ({
        title: a.invoice_number || `Invoice #${a.invoice_id}`,
        cells: { invoiceDate: formatDate(a.invoice_date), allocatedOn: formatDate(a.allocated_at), amount: money(a.amount) },
      })),
      empty: 'This receipt has not been allocated to an invoice yet.',
    },
    blocks: [{ label: 'Payment notes', text: payment?.notes || 'No additional payment note was recorded.' }],
    totals: [
      { label: 'Amount received', value: money(payment?.amount), emphasis: 'grand' },
      { label: 'Allocated amount', value: money(payment?.allocated_amount) },
      { label: 'Unallocated balance', value: money(payment?.unallocated_amount), emphasis: 'due' },
    ],
    footer: { message: 'Thank you for your payment.', note: 'This receipt was generated from the payment records maintained in DigitalInvoice.' },
    summary: { label: 'Amount received', value: money(payment?.amount), caption: `${paymentMethodLabel(payment?.payment_method)} · ${formatDate(payment?.payment_date)}` },
    recipient: payment?.customer_name_snapshot || payment?.payer_name,
  }
}

/* ---- Proforma invoice / delivery note ---- */
const supportModel = (type, doc, org, logo) => {
  const isDelivery = type === 'delivery_note'
  const currency = doc?.currency || doc?.invoice_currency || 'NGN'
  const money = (v) => formatCurrency(v, currency)
  const number = isDelivery
    ? doc?.delivery_note_number || `DN-${String(doc?.id || '').padStart(6, '0')}`
    : doc?.proforma_number || `PF-${String(doc?.id || '').padStart(6, '0')}`
  const status = doc?.status || 'draft'
  const items = doc?.items || []
  return {
    type,
    eyebrow: isDelivery ? 'Delivery note' : 'Proforma',
    title: isDelivery ? 'Delivery Note' : 'Proforma Invoice',
    number,
    statuses: [{ text: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '), tone: toneFor(status) }],
    seller: { ...seller(org, logo), name: businessName(org), lines: [org?.address || 'Business address', join(org?.business_email, org?.phone)].filter(Boolean) },
    party: {
      label: 'Customer',
      name: doc?.customer_name_snapshot || '—',
      lines: [doc?.customer_address_snapshot || doc?.delivery_address || '—', join(doc?.customer_email_snapshot, doc?.customer_phone_snapshot) || '—'],
    },
    meta: isDelivery
      ? [
          { label: 'Delivery date', value: formatDate(doc?.delivery_date) },
          { label: 'Linked invoice', value: doc?.invoice_number || '—' },
          { label: 'Reference', value: doc?.reference || '—' },
        ]
      : [
          { label: 'Issue date', value: formatDate(doc?.issue_date) },
          { label: 'Valid until', value: formatDate(doc?.expiry_date) },
          { label: 'Currency', value: currency },
          { label: 'Reference', value: doc?.reference || '—' },
        ],
    table: {
      columns: isDelivery
        ? [{ key: 'ordered', label: 'Ordered', align: 'right' }, { key: 'delivered', label: 'Delivered', align: 'right', strong: true }]
        : [
            { key: 'qty', label: 'Qty', align: 'right' },
            { key: 'unit', label: 'Unit price', align: 'right' },
            { key: 'vat', label: 'VAT', align: 'right' },
            { key: 'total', label: 'Total', align: 'right', strong: true },
          ],
      rows: items.map((line) => ({
        title: line.item_name_snapshot,
        subtitle: line.item_code_snapshot || line.item_description_snapshot,
        cells: isDelivery
          ? { ordered: `${line.invoice_quantity ?? ''} ${line.unit_code_snapshot || ''}`.trim(), delivered: `${line.delivered_quantity ?? ''} ${line.unit_code_snapshot || ''}`.trim() }
          : { qty: `${line.quantity ?? ''} ${line.unit_code_snapshot || ''}`.trim(), unit: money(line.unit_price), vat: money(line.tax_amount), total: money(line.total_amount) },
      })),
    },
    blocks: isDelivery
      ? [{ label: 'Delivery address', text: doc?.delivery_address || doc?.customer_address_snapshot || '—', card: true }]
      : [{ label: 'Payment instructions', text: doc?.payment_instructions || 'Payment details will be confirmed on the final invoice.', card: true }],
    totals: isDelivery ? [] : [
      { label: 'Subtotal', value: money(doc?.subtotal_amount) },
      { label: 'VAT / Tax', value: money(doc?.tax_amount) },
      { label: 'Total estimate', value: money(doc?.total_amount), emphasis: 'due' },
    ],
    footer: { message: isDelivery ? 'Items received as listed above.' : 'This is not a tax invoice.', note: doc?.notes || doc?.footer_note || 'Thank you for doing business with us.' },
    summary: isDelivery
      ? { label: 'Delivery date', value: formatDate(doc?.delivery_date), caption: doc?.invoice_number ? `Linked to ${doc.invoice_number}` : `${items.length} item${items.length === 1 ? '' : 's'}` }
      : { label: 'Total estimate', value: money(doc?.total_amount), caption: `Valid until ${formatDate(doc?.expiry_date)}` },
    recipient: doc?.customer_name_snapshot,
  }
}

// Portal document types (payload.document_type) -> data key, title, reference, model
export const DOCUMENT_TYPES = {
  invoice: { key: 'invoice', title: 'Invoice', reference: (d) => d?.invoice_number || `invoice-${d?.id || 'document'}`, build: invoiceModel },
  credit_note: { key: 'credit_note', title: 'Credit Note', reference: (d) => d?.credit_note_number || `credit-note-${d?.id || 'document'}`, build: creditNoteModel },
  payment_receipt: { key: 'payment', title: 'Payment Receipt', reference: (d) => d?.receipt_number || `receipt-${d?.id || 'document'}`, build: receiptModel },
  proforma: { key: 'proforma', title: 'Proforma Invoice', reference: (d) => d?.proforma_number || `proforma-${d?.id || 'document'}`, build: (d, o, l) => supportModel('proforma', d, o, l) },
  proforma_invoice: { key: 'proforma', title: 'Proforma Invoice', reference: (d) => d?.proforma_number || `proforma-${d?.id || 'document'}`, build: (d, o, l) => supportModel('proforma', d, o, l) },
  delivery_note: { key: 'delivery_note', title: 'Delivery Note', reference: (d) => d?.delivery_note_number || `delivery-note-${d?.id || 'document'}`, build: (d, o, l) => supportModel('delivery_note', d, o, l) },
}

export const safeFileName = (value, fallback = 'customer-document') => (
  String(value || fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback
)
