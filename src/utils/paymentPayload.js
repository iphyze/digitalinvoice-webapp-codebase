export const unwrapApiData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

export const firstArray = (...values) => values.find((value) => Array.isArray(value)) || [];

export const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const paymentRecordFromResponse = (response) => {
  const data = unwrapApiData(response);
  return data.payment || data.record || data.data?.payment || null;
};

export const paymentListFromResponse = (response) => {
  const data = unwrapApiData(response);
  const payments = firstArray(data.payments, data.records, data.data?.payments, data.data);
  return {
    payments,
    pagination: data.pagination || data.meta || data.data?.pagination || {
      page: 1,
      total: payments.length,
      total_pages: payments.length ? 1 : 0,
      limit: payments.length || 10,
    },
  };
};

export const customerListFromResponse = (response) => {
  const data = unwrapApiData(response);
  return firstArray(data.customers, data.records, data.data?.customers, data.data);
};

export const bankAccountsFromResponse = (response) => {
  const data = unwrapApiData(response);
  return firstArray(data.bank_accounts, data.accounts, data.records, data.data?.bank_accounts, data.data);
};

export const outstandingInvoicesFromResponse = (response) => {
  const data = unwrapApiData(response);
  return firstArray(data.invoices, data.records, data.data?.invoices, data.data);
};

export const moneyRemaining = (payment) => numberValue(payment?.unallocated_amount);

export const buildPaymentPayload = (form, allocations = []) => ({
  customer_id: Number(form.customer_id),
  payment_date: form.payment_date,
  currency: form.currency,
  amount: String(form.amount || '').trim(),
  payment_method: form.payment_method,
  bank_account_id: form.bank_account_id || null,
  reference: form.reference?.trim() || null,
  payer_name: form.payer_name?.trim() || null,
  notes: form.notes?.trim() || null,
  allocations: allocations
    .filter((row) => Number(row.invoice_id) > 0 && numberValue(row.amount) > 0)
    .map((row) => ({ invoice_id: Number(row.invoice_id), amount: String(row.amount) })),
});
