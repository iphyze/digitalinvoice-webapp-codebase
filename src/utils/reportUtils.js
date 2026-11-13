import { format } from 'date-fns';

export const CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const startOfYear = new Date(today.getFullYear(), 0, 1);
const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
const priorYearStart = new Date(today.getFullYear() - 1, 0, 1);
const priorYearEnd = new Date(today.getFullYear() - 1, 11, 31);
const last12MonthsStart = new Date(today.getFullYear(), today.getMonth() - 11, 1);

export const formatInputDate = (date) => format(date, 'yyyy-MM-dd');

export const REPORT_PERIODS = [
  { value: 'month_to_date', label: 'Month to date', from: formatInputDate(startOfMonth), to: formatInputDate(today) },
  { value: 'quarter_to_date', label: 'Quarter to date', from: formatInputDate(startOfQuarter), to: formatInputDate(today) },
  { value: 'year_to_date', label: 'Year to date', from: formatInputDate(startOfYear), to: formatInputDate(today) },
  { value: 'last_12_months', label: 'Last 12 months', from: formatInputDate(last12MonthsStart), to: formatInputDate(today) },
  { value: 'prior_year', label: 'Prior year', from: formatInputDate(priorYearStart), to: formatInputDate(priorYearEnd) },
  { value: 'custom', label: 'Custom range', from: formatInputDate(startOfMonth), to: formatInputDate(today) },
];

export const defaultReportFilters = () => ({
  period: 'month_to_date',
  from: REPORT_PERIODS[0].from,
  to: REPORT_PERIODS[0].to,
  currency: 'NGN',
  search: '',
  status: '',
  payment_status: '',
  method: '',
});

export const unwrapResponse = (response) => {
  const payload = response?.data ?? response ?? {};
  return payload?.data ?? payload;
};

export const asArray = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export const pickNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (!Number.isNaN(number)) return number;
  }
  return 0;
};

export const makeQueryParams = (filters = {}) => {
  const params = {
    from: filters.from,
    to: filters.to,
    currency: filters.currency,
    search: filters.search?.trim(),
    status: filters.status,
    payment_status: filters.payment_status,
    method: filters.method,
  };

  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));
};

export const exportRowsToCsv = (filename, rows, columns) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = columns.map((column) => column.label);
  const body = safeRows.map((row) => columns.map((column) => {
    const value = column.value(row);
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }).join(','));
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
