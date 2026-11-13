/*
  Route guards, ported unchanged in logic from the previous app.
  They read the auth store only; the UI around them is new.
*/
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../../stores/useAuthStore'
import { platformPermission } from '../../utils/platformPermissions'
import { hasPermission } from '../../utils/permissions'
import { entitlementFeatureForPermission, hasEntitledPermission, hasEntitlement } from '../../utils/entitlements'
import PageLoader from '../../components/ui/PageLoader'
import { APP_PATHS } from '../../utils/appPaths'
import UpgradePrompt from '../../components/ui/UpgradePrompt'

/** Signed-in users only; others go to /login and come back afterwards. */
export function AuthenticatedRoute() {
  const location = useLocation()
  const status = useAuthStore((s) => s.status)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mfaPolicy = useAuthStore((s) => s.mfaPolicy)
  const nextPath = useAuthStore((s) => s.nextPath)
  if (status === 'checking') return <PageLoader />
  if (!isAuthenticated()) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Enforced MFA is checked before platform, subscription, onboarding or permission guards.
  // The enrolment route itself is the sole exception, preventing a redirect loop.
  if (mfaPolicy?.enrolment_required && location.pathname !== APP_PATHS.mfaEnrollment) {
    return <Navigate to={APP_PATHS.mfaEnrollment} replace />
  }
  if (!mfaPolicy?.enrolment_required && location.pathname === APP_PATHS.mfaEnrollment) {
    return <Navigate to={nextPath()} replace />
  }
  return <Outlet />
}

/** Guests only (login, register…); signed-in users go to their start page. */
export function PublicRoute() {
  const status = useAuthStore((s) => s.status)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const nextPath = useAuthStore((s) => s.nextPath)
  if (status === 'checking') return <PageLoader />
  if (isAuthenticated()) return <Navigate to={nextPath()} replace />
  return <Outlet />
}

/** Workspace must have finished onboarding. */
export function OperationalRoute() {
  const onboarding = useAuthStore((s) => s.onboarding)
  if (!onboarding?.can_access_workspace) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Subscription must grant product access. */
export function SubscriptionActiveRoute() {
  const access = useAuthStore((s) => s.access)
  if (!access?.has_product_access) return <Navigate to="/subscription/plans" replace />
  return <Outlet />
}

/** Platform administrators only. */
export function PlatformRoute() {
  const user = useAuthStore((s) => s.user)
  const platformAccess = useAuthStore((s) => s.platformAccess)
  const allowed = Boolean(platformAccess?.can_access_platform || user?.role === 'platform_admin')
  if (!allowed) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

/** Platform role capabilities; do not use workspace plan entitlements for platform routes. */
export function PlatformPermissionRoute({ permission }) {
  const access = useAuthStore((s) => s.platformAccess)
  const user = useAuthStore((s) => s.user)
  if (!platformPermission(access, user, permission)) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

/** Role permission, then plan entitlement (shows the upgrade prompt if the plan lacks it). */
export function PermissionRoute({ permission, feature }) {
  const permissions = useAuthStore((s) => s.permissions)
  const entitlements = useAuthStore((s) => s.entitlements)
  const featureKey = feature || entitlementFeatureForPermission(permission)
  if (!hasPermission(permissions, permission)) return <Navigate to="/unauthorized" replace />
  if (featureKey ? !hasEntitlement(entitlements, featureKey) : !hasEntitledPermission(entitlements, permission)) {
    return <UpgradePrompt featureKey={featureKey} />
  }
  return <Outlet />
}

/** ERP management is restricted to organisation owners/admins by the PHP API. */
export function OrganizationAdminRoute() {
  const user = useAuthStore((state) => state.user)
  if (!['owner', 'admin'].includes(String(user?.role || '').toLowerCase())) {
    return <Navigate to="/unauthorized" replace />
  }
  return <Outlet />
}
