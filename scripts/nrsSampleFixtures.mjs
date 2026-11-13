/**
 * Development-only, deterministic fictional documents for public NRS layout
 * illustrations. These are NOT database rows, NRS fixtures or verified evidence.
 */
export const fictionalSeller = Object.freeze({
  name: 'Example Merchant Limited (FICTIONAL)',
  trading_name: 'Example Merchant Limited (FICTIONAL)',
  address: '12 Illustration Road, Test District, Lagos (fictional)',
  business_email: 'accounts@example.invalid',
  phone: '000-000-0000',
  tax_identification_number: 'MOCK-TIN-NOT-VALID',
})

const customer = {
  customer_name_snapshot: 'Example Buyer Nigeria Limited (FICTIONAL)',
  customer_address_snapshot: '48 Sample Avenue, Test District, Abuja (fictional)',
  customer_email_snapshot: 'buyer@example.invalid',
  customer_phone_snapshot: '000-000-0000',
  customer_tin_snapshot: 'MOCK-TIN-NOT-VALID',
}

export const fictionalDocuments = Object.freeze([
  {
    key: 'b2b-tax-invoice',
    documentType: 'invoice',
    title: 'B2B tax invoice',
    description: 'Tax invoice containing multiple lines, discounts and VAT.',
    record: {
      id: 1001, invoice_number: 'SAMPLE-INV-B2B-001', status: 'approved',
      nrs_submission_status: 'not_submitted', payment_status: 'unpaid',
      invoice_date: '2026-11-05', due_date: '2026-12-05', currency: 'NGN',
      firs_document_type: 'tax_invoice', firs_transaction_type: 'b2b',
      reference: 'MOCK-PO-1001', bank_name_snapshot: 'Illustrative Bank (not real)',
      bank_account_name_snapshot: 'Example Merchant Limited (fictional)',
      bank_account_number_snapshot: 'MOCK-NO-ACCOUNT',
      subtotal_amount: '325000.00', line_discount_amount: '7500.00',
      invoice_discount_amount: '0.00', net_amount: '317500.00',
      tax_amount: '23812.50', total_amount: '341312.50', amount_paid: '0.00',
      balance_due: '341312.50', footer_note: 'DEMONSTRATION ONLY — No real sale has occurred.',
      ...customer,
      lines: [
        {
          item_name_snapshot: 'Fictional office equipment', item_description_snapshot: 'Example goods only',
          unit_code_snapshot: 'EA', quantity: '2.0000', unit_price: '125000.00',
          line_discount_amount: '0.00', invoice_discount_allocated_amount: '0.00',
          taxable_amount: '250000.00', tax_amount: '18750.00', total_amount: '268750.00',
        },
        {
          item_name_snapshot: 'Fictional setup service', item_description_snapshot: 'Example services only',
          unit_code_snapshot: 'JOB', quantity: '5.0000', unit_price: '15000.00',
          line_discount_amount: '7500.00', invoice_discount_allocated_amount: '0.00',
          taxable_amount: '67500.00', tax_amount: '5062.50', total_amount: '72562.50',
        },
      ],
    },
  },
  {
    key: 'b2c-simplified-invoice',
    documentType: 'invoice',
    title: 'B2C simplified invoice',
    description: 'Simplified consumer tax invoice with a single VAT-rated item.',
    record: {
      id: 1002, invoice_number: 'SAMPLE-INV-B2C-002', status: 'approved',
      nrs_submission_status: 'not_submitted', payment_status: 'unpaid',
      invoice_date: '2026-11-05', due_date: '2026-11-05', currency: 'NGN',
      firs_document_type: 'simplified_tax_invoice', firs_transaction_type: 'b2c',
      subtotal_amount: '60000.00', line_discount_amount: '0.00',
      invoice_discount_amount: '0.00', net_amount: '60000.00',
      tax_amount: '4500.00', total_amount: '64500.00', amount_paid: '0.00',
      balance_due: '64500.00', footer_note: 'DEMONSTRATION ONLY — No real sale has occurred.',
      customer_name_snapshot: 'Example Retail Customer (FICTIONAL)',
      customer_address_snapshot: 'Sample District, Lagos (fictional)',
      customer_email_snapshot: 'consumer@example.invalid',
      customer_phone_snapshot: '000-000-0000',
      lines: [{
        item_name_snapshot: 'Fictional household appliance',
        item_description_snapshot: 'Example consumer purchase',
        unit_code_snapshot: 'EA', quantity: '1.0000', unit_price: '60000.00',
        line_discount_amount: '0.00', invoice_discount_allocated_amount: '0.00',
        taxable_amount: '60000.00', tax_amount: '4500.00', total_amount: '64500.00',
      }],
    },
  },
  {
    key: 'credit-note',
    documentType: 'credit_note',
    title: 'Credit note',
    description: 'Fictional credit adjustment referencing an illustrative source invoice.',
    record: {
      id: 1003, invoice_id: 1001, invoice_number: 'SAMPLE-INV-B2B-001',
      invoice_date: '2026-11-05', invoice_total_amount: '341312.50',
      credit_note_number: 'SAMPLE-CN-003', status: 'approved',
      reason_category: 'billing_error', reason: 'Example quantity adjustment only.',
      credit_note_date: '2026-11-06', currency: 'NGN',
      subtotal_amount: '40000.00', line_discount_amount: '0.00',
      invoice_discount_amount: '0.00', net_amount: '40000.00',
      tax_amount: '3000.00', total_amount: '43000.00',
      notes: 'DEMONSTRATION ONLY — No real credit was issued.', ...customer,
      lines: [{
        item_name_snapshot: 'Fictional adjustment item', item_description_snapshot: 'Example correction',
        unit_code_snapshot: 'EA', quantity: '1.0000', unit_price: '40000.00',
        taxable_amount: '40000.00', tax_amount: '3000.00', total_amount: '43000.00',
      }],
    },
  },
  {
    key: 'payment-receipt',
    documentType: 'payment_receipt',
    title: 'Payment receipt',
    description: 'Fictional receipt with an illustrative invoice allocation.',
    record: {
      id: 1004, receipt_number: 'SAMPLE-RCP-004', status: 'allocated',
      payment_date: '2026-11-06', payment_method: 'bank_transfer', currency: 'NGN',
      amount: '100000.00', allocated_amount: '100000.00', unallocated_amount: '0.00',
      reference: 'MOCK-PAYMENT-REF-004', notes: 'DEMONSTRATION ONLY — No payment occurred.',
      payer_name: 'Example Buyer Nigeria Limited (FICTIONAL)',
      ...customer,
      allocations: [{
        invoice_id: 1001, invoice_number: 'SAMPLE-INV-B2B-001',
        invoice_date: '2026-11-05', allocated_at: '2026-11-06', amount: '100000.00',
      }],
    },
  },
])

export function assertSampleArithmetic() {
  const invoiceFields = ['subtotal_amount', 'line_discount_amount', 'invoice_discount_amount', 'net_amount', 'tax_amount', 'total_amount']
  const cents = (v) => Math.round(Number(v) * 100)
  for (const { title, record, documentType } of fictionalDocuments) {
    if (documentType === 'payment_receipt') {
      if (cents(record.amount) !== cents(record.allocated_amount) + cents(record.unallocated_amount)) throw new Error(`${title}: receipt amount mismatch`)
      continue
    }
    for (const key of invoiceFields) if (!Number.isFinite(Number(record[key]))) throw new Error(`${title}: invalid ${key}`)
    if (cents(record.net_amount) !== cents(record.subtotal_amount) - cents(record.line_discount_amount) - cents(record.invoice_discount_amount)) throw new Error(`${title}: net amount mismatch`)
    if (cents(record.total_amount) !== cents(record.net_amount) + cents(record.tax_amount)) throw new Error(`${title}: total amount mismatch`)
    if (record.lines?.length) {
      const lineTotal = record.lines.reduce((sum, line) => sum + cents(line.total_amount), 0)
      if (lineTotal !== cents(record.total_amount)) throw new Error(`${title}: line totals mismatch`)
    }
  }
}
