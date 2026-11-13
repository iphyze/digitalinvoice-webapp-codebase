import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ScreenPlaceholder from '../pages/system/ScreenPlaceholder'
import {
  AuthenticatedRoute, OperationalRoute, OrganizationAdminRoute, PermissionRoute, PlatformRoute, PlatformPermissionRoute, PublicRoute, SubscriptionActiveRoute,
} from './guards'
import { AppShell, AuthLayout, PlatformShell } from './layouts'

// Redesigned screens
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'))
const PlatformDashboard = lazy(() => import('../pages/platform/PlatformDashboard'))
const PlatformClients = lazy(() => import('../pages/platform/PlatformClients'))
const PlatformClientDetails = lazy(() => import('../pages/platform/PlatformClientDetails'))
const PlatformUsers = lazy(() => import('../pages/platform/PlatformUsers'))
const PlatformPlans = lazy(() => import('../pages/platform/PlatformPlans'))
const PlatformSubscriptions = lazy(() => import('../pages/platform/PlatformSubscriptions'))
const PlatformSubscriptionDetails = lazy(() => import('../pages/platform/PlatformSubscriptionDetails'))
const PlatformPremiumRequests = lazy(() => import('../pages/platform/PlatformPremiumRequests'))
const PlatformRevenue = lazy(() => import('../pages/platform/PlatformRevenue'))
const PlatformActivity = lazy(() => import('../pages/platform/PlatformActivity'))
const PlatformProfile = lazy(() => import('../pages/platform/PlatformProfile'))
const PlatformSettings = lazy(() => import('../pages/platform/PlatformSettings'))
const PlatformFirsIntegration = lazy(() => import('../pages/platform/PlatformFirsIntegration'))
const Reports = lazy(() => import('../pages/reports/Reports'))
const InvoiceRegister = lazy(() => import('../pages/reports/InvoiceRegister'))
const PaymentRegister = lazy(() => import('../pages/reports/PaymentRegister'))
const ReceivablesAging = lazy(() => import('../pages/reports/ReceivablesAging'))
const CustomerStatement = lazy(() => import('../pages/reports/CustomerStatement'))
const VatSummary = lazy(() => import('../pages/reports/VatSummary'))
const ComplianceReadiness = lazy(() => import('../pages/reports/ComplianceReadiness'))
const Login = lazy(() => import('../pages/auth/Login'))
const Register = lazy(() => import('../pages/auth/Register'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'))
const CheckEmail = lazy(() => import('../pages/auth/CheckEmail'))
const VerifyEmail = lazy(() => import('../pages/auth/VerifyEmail'))
const MfaEnrollment = lazy(() => import('../pages/security/MfaEnrollment'))
const Landing = lazy(() => import('../pages/public/Landing'))
const RequestDemo = lazy(() => import('../pages/public/RequestDemo'))
const Plans = lazy(() => import('../pages/subscription/Plans'))
const Onboarding = lazy(() => import('../pages/onboarding/Onboarding'))
const CustomerPortal = lazy(() => import('../pages/portal/CustomerPortal'))
const CustomerPortalLinks = lazy(() => import('../pages/portalLinks/CustomerPortalLinks'))
const Customers = lazy(() => import('../pages/customers/Customers'))
const CustomerDetails = lazy(() => import('../pages/customers/CustomerDetails'))
const Catalogue = lazy(() => import('../pages/catalogue/Catalogue'))
const ItemDetails = lazy(() => import('../pages/catalogue/ItemDetails'))
const Invoices = lazy(() => import('../pages/invoices/Invoices'))
const InvoiceEditor = lazy(() => import('../pages/invoices/InvoiceEditor'))
const InvoiceDetails = lazy(() => import('../pages/invoices/InvoiceDetails'))
const CreditNoteDetails = lazy(() => import('../pages/creditNotes/CreditNoteDetails'))
const CreditNotes = lazy(() => import('../pages/creditNotes/CreditNotes'))
const CreditNoteEditor = lazy(() => import('../pages/creditNotes/CreditNoteEditor'))
const ProformaInvoices = lazy(() => import('../pages/proformaInvoices/ProformaInvoices'))
const ProformaEditor = lazy(() => import('../pages/proformaInvoices/ProformaEditor'))
const ProformaDetails = lazy(() => import('../pages/proformaInvoices/ProformaDetails'))
const DeliveryNotes = lazy(() => import('../pages/deliveryNotes/DeliveryNotes'))
const DeliveryNoteEditor = lazy(() => import('../pages/deliveryNotes/DeliveryNoteEditor'))
const DeliveryNoteDetails = lazy(() => import('../pages/deliveryNotes/DeliveryNoteDetails'))
const Payments = lazy(() => import('../pages/payments/Payments'))
const PaymentDetails = lazy(() => import('../pages/payments/PaymentDetails'))
const OrganizationSettings = lazy(() => import('../pages/settings/OrganizationSettings'))
const Profile = lazy(() => import('../pages/settings/Profile'))
const ErpIntegrations = lazy(() => import('../pages/integrations/ErpIntegrations'))
const TeamMembers = lazy(() => import('../pages/team/TeamMembers'))
const TaxRates = lazy(() => import('../pages/admin/TaxRates'))
const ActivityLog = lazy(() => import('../pages/admin/ActivityLog'))
const NotFound = lazy(() => import('../pages/system/NotFound'))
const Unauthorized = lazy(() => import('../pages/system/Unauthorized'))
const VerifyPayment = lazy(() => import('../pages/subscription/VerifyPayment'))
const AcceptInvitation = lazy(() => import('../pages/auth/AcceptInvitation'))
const AcceptPlatformInvitation = lazy(() => import('../pages/auth/AcceptPlatformInvitation'))

const screen = (title, section) => <ScreenPlaceholder title={title} section={section} />

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/request-demo" element={<RequestDemo />} />
      <Route path="/portal/:token" element={<CustomerPortal />} />
      {/* Verification must remain publicly accessible, including for signed-in users. */}
      <Route element={<AuthLayout />}>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/check-email" element={<CheckEmail />} />
        {/* Invitations: public (the invitee may not have an account yet) */}
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/team/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/platform/accept-invitation" element={<AcceptPlatformInvitation />} />
      </Route>

      {/* Guests only */}
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Route>

      {/* Signed in */}
      <Route element={<AuthenticatedRoute />}>
        {/* Mandatory security enrolment must bypass subscription/onboarding/platform guards. */}
        <Route path="/security/mfa" element={<MfaEnrollment />} />
        <Route path="/subscription/plans" element={<Plans />} />
        <Route path="/subscription/verify" element={<VerifyPayment />} />

        <Route element={<PlatformRoute />}>
          <Route path="/platform" element={<PlatformShell />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route element={<PlatformPermissionRoute permission="platform.dashboard" />}>
              <Route path="dashboard" element={<PlatformDashboard />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.users.view" />}>
              <Route path="users" element={<PlatformUsers />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.clients.view" />}>
              <Route path="clients" element={<PlatformClients />} />
              <Route path="clients/:id" element={<PlatformClientDetails />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.plans.view" />}>
              <Route path="plans" element={<PlatformPlans />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.subscriptions.view" />}>
              <Route path="subscriptions" element={<PlatformSubscriptions />} />
              <Route path="subscriptions/:id" element={<PlatformSubscriptionDetails />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.premium_requests.view" />}>
              <Route path="premium-requests" element={<PlatformPremiumRequests />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.revenue.view" />}>
              <Route path="revenue" element={<PlatformRevenue />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.activity.view" />}>
              <Route path="activity" element={<PlatformActivity />} />
            </Route>
            <Route path="profile" element={<PlatformProfile />} />
            <Route element={<PlatformPermissionRoute permission="platform.settings.view" />}>
              <Route path="settings" element={<PlatformSettings />} />
            </Route>
            <Route element={<PlatformPermissionRoute permission="platform.firs.view" />}>
              <Route path="firs-integration" element={<PlatformFirsIntegration />} />
            </Route>
          </Route>
        </Route>

        <Route element={<SubscriptionActiveRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<OperationalRoute />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route element={<PermissionRoute permission="dashboard.view" />}>
                <Route path="dashboard" element={<Dashboard />} />
              </Route>
              <Route element={<PermissionRoute permission="customers.view" />}>
                <Route path="customers" element={<Customers />} />
                <Route path="customers/:id" element={<CustomerDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="catalogue.view" />}>
                <Route path="catalogue" element={<Catalogue />} />
                <Route path="catalogue/:id" element={<ItemDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="tax_rates.view" />}>
                <Route path="settings/tax-rates" element={<TaxRates />} />
              </Route>
              <Route element={<PermissionRoute permission="invoices.view" />}>
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/:id" element={<InvoiceDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="invoices.create" />}>
                <Route path="invoices/new" element={<InvoiceEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="invoices.edit" />}>
                <Route path="invoices/:id/edit" element={<InvoiceEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="credit_notes.view" />}>
                <Route path="credit-notes" element={<CreditNotes />} />
                <Route path="credit-notes/:id" element={<CreditNoteDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="credit_notes.create" />}>
                <Route path="credit-notes/new" element={<CreditNoteEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="credit_notes.edit" />}>
                <Route path="credit-notes/:id/edit" element={<CreditNoteEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="proformas.view" />}>
                <Route path="proforma-invoices" element={<ProformaInvoices />} />
                <Route path="proforma-invoices/:id" element={<ProformaDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="proformas.create" />}>
                <Route path="proforma-invoices/new" element={<ProformaEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="proformas.edit" />}>
                <Route path="proforma-invoices/:id/edit" element={<ProformaEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="delivery_notes.view" />}>
                <Route path="delivery-notes" element={<DeliveryNotes />} />
                <Route path="delivery-notes/:id" element={<DeliveryNoteDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="delivery_notes.create" />}>
                <Route path="delivery-notes/new" element={<DeliveryNoteEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="delivery_notes.edit" />}>
                <Route path="delivery-notes/:id/edit" element={<DeliveryNoteEditor />} />
              </Route>
              <Route element={<PermissionRoute permission="portal_links.manage" />}>
                <Route path="customer-portal" element={<CustomerPortalLinks />} />
              </Route>
              <Route element={<PermissionRoute permission="payments.view" />}>
                <Route path="payments" element={<Payments />} />
                <Route path="payments/:id" element={<PaymentDetails />} />
              </Route>
              <Route element={<PermissionRoute permission="team.view" />}>
                <Route path="team" element={<TeamMembers />} />
              </Route>
              <Route element={<PermissionRoute permission="reports.view" />}>
                <Route path="reports" element={<Reports />} />
                <Route path="reports/invoices" element={<InvoiceRegister />} />
                <Route path="reports/payments" element={<PaymentRegister />} />
                <Route path="reports/receivables-aging" element={<ReceivablesAging />} />
                <Route path="reports/customer-statement" element={<CustomerStatement />} />
                <Route path="reports/vat-summary" element={<VatSummary />} />
                <Route path="reports/compliance-readiness" element={<ComplianceReadiness />} />
              </Route>
              <Route element={<PermissionRoute permission="organization.manage" feature="activity_log" />}>
                <Route path="activity-log" element={<ActivityLog />} />
              </Route>
              <Route element={<PermissionRoute permission="organization.manage" feature="organization_settings" />}>
                <Route path="settings/organization" element={<OrganizationSettings />} />
              </Route>
              <Route element={<OrganizationAdminRoute />}>
                <Route path="settings/integrations" element={<ErpIntegrations />} />
              </Route>
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
