import {
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'quarter_to_date', label: 'Quarter to date' },
  { value: 'year_to_date', label: 'Year to date' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'prior_year', label: 'Prior year' },
  { value: 'custom', label: 'Custom range' },
];

export const DASHBOARD_CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const toIso = (date) => format(date, 'yyyy-MM-dd');

export const getDashboardPresetPeriod = (preset, today = new Date()) => {
  switch (preset) {
    case 'quarter_to_date':
      return { from: toIso(startOfQuarter(today)), to: toIso(today) };
    case 'year_to_date':
      return { from: toIso(startOfYear(today)), to: toIso(today) };
    case 'last_12_months':
      return { from: toIso(startOfMonth(subMonths(today, 11))), to: toIso(today) };
    case 'prior_year': {
      const priorYear = subYears(today, 1);
      return { from: toIso(startOfYear(priorYear)), to: toIso(endOfYear(priorYear)) };
    }
    case 'month_to_date':
    default:
      return { from: toIso(startOfMonth(today)), to: toIso(today) };
  }
};

export const createDashboardFilters = (preset = 'month_to_date', currency = 'NGN') => ({
  preset,
  currency,
  ...getDashboardPresetPeriod(preset),
});

export const DEFAULT_DASHBOARD_FILTERS = createDashboardFilters();
