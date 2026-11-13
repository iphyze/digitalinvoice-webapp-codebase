const moneyNumber = (value) => {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMinor = (value) => Math.round(moneyNumber(value) * 100);
const fromMinor = (minor) => (minor / 100).toFixed(2);
const percentageDiscount = (amountMinor, percentage) => Math.round((amountMinor * moneyNumber(percentage)) / 100);

const calculateDiscount = (amountMinor, type, value) => {
  if (type === 'fixed') return Math.min(amountMinor, toMinor(value));
  if (type === 'percentage') return Math.min(amountMinor, percentageDiscount(amountMinor, value));
  return 0;
};

const lineIsComplete = (line) => Boolean(
  line?.item_id
  && moneyNumber(line.quantity) > 0
  && String(line.unit_price ?? '').trim() !== ''
  && moneyNumber(line.unit_price) >= 0
  && line.tax_rate_id,
);

export const getCompletedInvoiceLines = (lines = []) => lines.filter(lineIsComplete);

export const calculateInvoicePreview = ({ lines = [], taxRates = [], discountType = 'none', discountValue = 0 }) => {
  const completedLines = getCompletedInvoiceLines(lines);
  if (!completedLines.length) return null;

  const preparedLines = completedLines.map((line) => {
    const grossMinor = Math.round(moneyNumber(line.quantity) * toMinor(line.unit_price));
    const lineDiscountMinor = calculateDiscount(grossMinor, line.discount_type, line.discount_value);
    const netBeforeInvoiceDiscountMinor = grossMinor - lineDiscountMinor;
    const taxRate = taxRates.find((rate) => String(rate.id) === String(line.tax_rate_id));
    const taxPercent = moneyNumber(taxRate?.rate_percent);
    const appliesTax = !taxRate?.treatment || taxRate.treatment === 'standard';

    return {
      grossMinor,
      lineDiscountMinor,
      netBeforeInvoiceDiscountMinor,
      taxPercent: appliesTax ? taxPercent : 0,
    };
  });

  const subtotalMinor = preparedLines.reduce((total, line) => total + line.grossMinor, 0);
  const lineDiscountMinor = preparedLines.reduce((total, line) => total + line.lineDiscountMinor, 0);
  const netBeforeInvoiceDiscountMinor = preparedLines.reduce((total, line) => total + line.netBeforeInvoiceDiscountMinor, 0);
  const invoiceDiscountMinor = calculateDiscount(netBeforeInvoiceDiscountMinor, discountType, discountValue);

  let allocatedMinor = 0;
  const allocations = preparedLines.map((line, index) => {
    if (!invoiceDiscountMinor || !netBeforeInvoiceDiscountMinor) return 0;
    if (index === preparedLines.length - 1) return invoiceDiscountMinor - allocatedMinor;
    const allocation = Math.round((invoiceDiscountMinor * line.netBeforeInvoiceDiscountMinor) / netBeforeInvoiceDiscountMinor);
    allocatedMinor += allocation;
    return allocation;
  });

  const netAmountMinor = preparedLines.reduce(
    (total, line, index) => total + Math.max(0, line.netBeforeInvoiceDiscountMinor - allocations[index]),
    0,
  );
  const taxAmountMinor = preparedLines.reduce((total, line, index) => {
    const taxableMinor = Math.max(0, line.netBeforeInvoiceDiscountMinor - allocations[index]);
    return total + Math.round((taxableMinor * line.taxPercent) / 100);
  }, 0);

  return {
    completedLineCount: completedLines.length,
    totals: {
      subtotal_amount: fromMinor(subtotalMinor),
      line_discount_amount: fromMinor(lineDiscountMinor),
      invoice_discount_amount: fromMinor(invoiceDiscountMinor),
      net_amount: fromMinor(netAmountMinor),
      tax_amount: fromMinor(taxAmountMinor),
      total_amount: fromMinor(netAmountMinor + taxAmountMinor),
    },
  };
};
