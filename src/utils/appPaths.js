export const APP_PATHS = {
  landing: '/',
  demo: '/request-demo',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  checkEmail: '/check-email',
  acceptInvitation: '/accept-invitation',
  plans: '/subscription/plans',
  paymentCallback: '/subscription/verify',
  onboarding: '/onboarding',
  dashboard: '/app/dashboard',
  platformDashboard: '/platform/dashboard',
  customers: '/app/customers',
  catalogue: '/app/catalogue',
  invoices: '/app/invoices',
  payments: '/app/payments',
  team: '/app/team',
  reports: '/app/reports',
  organizationSettings: '/app/settings/organization',
  profile: '/app/profile',
  mfaEnrollment: '/security/mfa',
};

export const resolveAuthenticatedStartPath = ({ access, onboarding, user, mfa_policy: mfaPolicy, mfaPolicy: camelMfaPolicy, platform_access: platformAccess, platformAccess: camelPlatformAccess }) => {
  if ((mfaPolicy || camelMfaPolicy)?.enrolment_required) return APP_PATHS.mfaEnrollment;
  const effectivePlatformAccess = platformAccess || camelPlatformAccess;
  if (effectivePlatformAccess?.can_access_platform || user?.role === 'platform_admin') return APP_PATHS.platformDashboard;
  if (access?.stage === 'email_verification_required') {
    const email = user?.email ? `?email=${encodeURIComponent(user.email)}` : '';
    return `${APP_PATHS.checkEmail}${email}`;
  }
  if (!access?.has_product_access) return APP_PATHS.plans;
  if (!onboarding?.can_access_workspace) return APP_PATHS.onboarding;
  return APP_PATHS.dashboard;
};

/**
 * Allow a post-login return only to the area granted by the server's start path.
 * Never override MFA enrolment, onboarding, subscription or email verification.
 * React Router guards still enforce each individual module permission.
 */
export const resolveSafePostLoginPath = (startPath, requestedPath) => {
  if (typeof requestedPath !== 'string' || requestedPath.length > 2048) return startPath;
  if (!requestedPath.startsWith('/') || requestedPath.startsWith('//') || requestedPath.includes('\\')) return startPath;
  if (/[\u0000-\u001F\u007F]/.test(requestedPath)) return startPath;
  const pathname = requestedPath.split(/[?#]/, 1)[0];
  if (pathname.split('/').some((segment) => segment === '.' || segment === '..')) return startPath;
  if (startPath === APP_PATHS.dashboard && /^\/app(?:\/|$)/.test(pathname)) return requestedPath;
  if (startPath === APP_PATHS.platformDashboard && /^\/platform(?:\/|$)/.test(pathname)
    && pathname !== '/platform/accept-invitation') return requestedPath;
  return startPath;
};
