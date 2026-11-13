import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CircleGauge,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  FileMinus2,
  FileText,
  FileSignature,
  FolderKanban,
  Link2,
  FileSpreadsheet,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  Truck,
  ShieldCheck,
  Waypoints,
  UsersRound,
  WalletCards,
} from 'lucide-react';

const reportPermissions = ['reports.view'];
const salesPermissions = [
  'customers.view',
  'catalogue.view',
  'invoices.view',
  'proformas.view',
  'delivery_notes.view',
  'credit_notes.view',
  'portal_links.manage',
];

export const reportNavigation = [
  { label: 'Invoice Register', path: '/app/reports/invoices', icon: ReceiptText, permissions: reportPermissions },
  { label: 'Payment Register', path: '/app/reports/payments', icon: WalletCards, permissions: reportPermissions },
  { label: 'Receivables Aging', path: '/app/reports/receivables-aging', icon: CircleGauge, permissions: reportPermissions },
  { label: 'Customer Statement', path: '/app/reports/customer-statement', icon: FileSpreadsheet, permissions: reportPermissions },
  { label: 'VAT Summary', path: '/app/reports/vat-summary', icon: FileBarChart2, permissions: reportPermissions },
  { label: 'Compliance Readiness', path: '/app/reports/compliance-readiness', icon: ShieldCheck, permissions: reportPermissions },
];

export const salesNavigation = [
  { label: 'Customers', path: '/app/customers', icon: UsersRound, permissions: ['customers.view'] },
  { label: 'Products & Services', path: '/app/catalogue', icon: Boxes, permissions: ['catalogue.view'] },
  { label: 'Invoices', path: '/app/invoices', icon: FileText, permissions: ['invoices.view'] },
  { label: 'Proforma Invoices', path: '/app/proforma-invoices', icon: FileSignature, permissions: ['proformas.view'] },
  { label: 'Delivery Notes', path: '/app/delivery-notes', icon: Truck, permissions: ['delivery_notes.view'] },
  { label: 'Credit Notes', path: '/app/credit-notes', icon: FileMinus2, permissions: ['credit_notes.view'] },
  { label: 'Customer Portal', path: '/app/customer-portal', icon: Link2, permissions: ['portal_links.manage'] },
];

export const workspaceNavigation = [
  { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, permissions: ['dashboard.view'] },
  { label: 'Sales', path: '/app/sales', icon: FolderKanban, permissions: salesPermissions, children: salesNavigation, groupOnly: true },
  { label: 'Payments', path: '/app/payments', icon: CreditCard, permissions: ['payments.view'] },
  { label: 'Reports', path: '/app/reports', icon: BarChart3, permissions: reportPermissions, children: reportNavigation },
];

export const administrativeNavigation = [
  { label: 'Subscription', path: '/subscription/plans', icon: CreditCard, permissions: ['organization.manage'], entitlementKeys: ['organization_settings'] },
  { label: 'Team Members', path: '/app/team', icon: Building2, permissions: ['team.view'] },
  { label: 'Activity Log', path: '/app/activity-log', icon: ClipboardList, permissions: ['organization.manage'], entitlementKeys: ['activity_log'] },
  { label: 'Tax Rates', path: '/app/settings/tax-rates', icon: BookOpen, permissions: ['tax_rates.view'] },
  { label: 'Organisation Settings', path: '/app/settings/organization', icon: Settings2, permissions: ['organization.manage'], entitlementKeys: ['organization_settings'] },
  { label: 'ERP Integrations', path: '/app/settings/integrations', icon: Waypoints, permissions: ['organization.manage'], roles: ['owner', 'admin'] },
];
