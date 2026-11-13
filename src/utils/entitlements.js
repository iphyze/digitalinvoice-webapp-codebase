export const PLAN_FEATURES = [
  { key: 'dashboard', label: 'Workspace dashboard', category: 'Core' },
  { key: 'customers', label: 'Customers', category: 'Sales' },
  { key: 'catalogue', label: 'Products & services', category: 'Sales' },
  { key: 'tax_rates', label: 'Tax rates', category: 'Compliance' },
  { key: 'invoices', label: 'Invoices', category: 'Sales' },
  { key: 'proformas', label: 'Proforma invoices', category: 'Sales' },
  { key: 'delivery_notes', label: 'Delivery notes', category: 'Operations' },
  { key: 'credit_notes', label: 'Credit notes', category: 'Sales' },
  { key: 'payments', label: 'Payments', category: 'Finance' },
  { key: 'reports', label: 'Reports', category: 'Finance' },
  { key: 'customer_portal', label: 'Customer portal', category: 'Experience' },
  { key: 'team_members', label: 'Team members', category: 'Administration' },
  { key: 'activity_log', label: 'Activity log', category: 'Administration' },
  { key: 'organization_settings', label: 'Organisation settings', category: 'Administration' },
  { key: 'profile', label: 'User profile', category: 'Administration' },
];

export const PLAN_LIMITS = [
  { key: 'invoices_per_month', label: 'Invoices per month' },
  { key: 'customers', label: 'Customer records' },
  { key: 'catalogue_items', label: 'Products/services' },
  { key: 'team_members', label: 'Workspace users' },
];

export const defaultEntitlements = {
  tier: 'starter',
  features: PLAN_FEATURES.reduce((acc, feature) => ({
    ...acc,
    [feature.key]: ['dashboard', 'customers', 'catalogue', 'tax_rates', 'invoices', 'organization_settings', 'profile'].includes(feature.key),
  }), {}),
  limits: {
    invoices_per_month: 50,
    customers: 100,
    catalogue_items: 100,
    team_members: 1,
  },
};

export const normalizeEntitlements = (entitlements = null) => {
  const source = entitlements && typeof entitlements === 'object' ? entitlements : {};
  const sourceFeatures = source.features && typeof source.features === 'object' ? source.features : {};
  const sourceLimits = source.limits && typeof source.limits === 'object' ? source.limits : {};

  const tier = source.tier || defaultEntitlements.tier;
  if (tier === 'premium') {
    return {
      tier,
      features: PLAN_FEATURES.reduce((acc, feature) => ({ ...acc, [feature.key]: true }), {}),
      limits: PLAN_LIMITS.reduce((acc, limit) => ({ ...acc, [limit.key]: -1 }), {}),
    };
  }

  return {
    tier,
    features: PLAN_FEATURES.reduce((acc, feature) => ({
      ...acc,
      [feature.key]: Object.prototype.hasOwnProperty.call(sourceFeatures, feature.key)
        ? Boolean(sourceFeatures[feature.key])
        : Boolean(defaultEntitlements.features[feature.key]),
    }), {}),
    limits: PLAN_LIMITS.reduce((acc, limit) => {
      const value = sourceLimits[limit.key];
      return {
        ...acc,
        [limit.key]: value === null || value === '' || value === 'unlimited' ? -1 : Number(value ?? defaultEntitlements.limits[limit.key] ?? -1),
      };
    }, {}),
  };
};

export const entitlementFeatureForPermission = (permission = '') => {
  const exact = {
    'organization.manage': 'organization_settings',
    'onboarding.manage': 'organization_settings',
    'team.view': 'team_members',
    'team.invite_limited': 'team_members',
    'tax_rates.view': 'tax_rates',
    'tax_rates.manage': 'tax_rates',
    'dashboard.view': 'dashboard',
    'portal_links.manage': 'customer_portal',
  };
  if (exact[permission]) return exact[permission];

  const prefixMap = [
    ['customers.', 'customers'],
    ['catalogue.', 'catalogue'],
    ['invoices.', 'invoices'],
    ['credit_notes.', 'credit_notes'],
    ['proformas.', 'proformas'],
    ['delivery_notes.', 'delivery_notes'],
    ['payments.', 'payments'],
    ['reports.', 'reports'],
  ];

  return prefixMap.find(([prefix]) => permission.startsWith(prefix))?.[1] || null;
};

export const featureLabel = (featureKey = '') => PLAN_FEATURES.find((feature) => feature.key === featureKey)?.label || 'This feature';

export const hasEntitlement = (entitlements, featureKey) => {
  if (!featureKey) return true;
  const normalised = normalizeEntitlements(entitlements);
  return Boolean(normalised.features[featureKey]);
};

export const hasEntitledPermission = (entitlements, permission) => {
  const featureKey = entitlementFeatureForPermission(permission);
  return hasEntitlement(entitlements, featureKey);
};

export const hasAnyEntitledPermission = (entitlements, permissions = []) => (
  permissions.length === 0 || permissions.some((permission) => hasEntitledPermission(entitlements, permission))
);

export const limitDisplay = (value) => (Number(value) < 0 ? 'Unlimited' : Number(value || 0).toLocaleString());
