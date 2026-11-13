import { create } from 'zustand';
import authService from '../services/authService';
import {
  initialiseCsrfToken,
  registerSessionExpiredHandler,
  registerMfaEnrollmentRequiredHandler,
  registerSessionRefreshedHandler,
  setCsrfToken,
} from '../services/api';
import { resolveAuthenticatedStartPath } from '../utils/appPaths';
import { getErrorMessage } from '../utils/httpError';

const blankSession = {
  user: null,
  organization: null,
  access: null,
  entitlements: null,
  onboarding: null,
  permissions: [],
  platformAccess: null,
  mfaPolicy: null,
  sessionExpiredMessage: null,
};

// /auth/session can fail after the short-lived access cookie expires while the
// HttpOnly refresh cookie is still valid. The endpoint intentionally skips the
// axios refresh interceptor, so restore it explicitly at startup and on pings.
let recoveryPromise = null;
let initializationPromise = null;

const fetchSessionWithRefresh = async () => {
  try {
    const response = await authService.session();
    return response.data?.data || {};
  } catch (error) {
    if (error?.response?.status !== 401) throw error;
    // Serialize refresh-cookie rotation: concurrent attempts can revoke each other.
    // Refresh requires the double-submit CSRF cookie/header pair.
    if (!recoveryPromise) {
      recoveryPromise = (async () => {
        const response = await authService.refresh();
        return response.data?.data || {};
      })().finally(() => { recoveryPromise = null; });
    }
    return recoveryPromise;
  }
};

const useAuthStore = create((set, get) => ({
  ...blankSession,
  status: 'checking',
  initialized: false,

  applyPayload: (payload = {}) => {
    set({
      user: payload.user || null,
      organization: payload.organization || null,
      access: payload.access || null,
      entitlements: payload.entitlements || payload.access?.entitlements || null,
      onboarding: payload.onboarding || null,
      permissions: payload.permissions || [],
      platformAccess: payload.platform_access || null,
      mfaPolicy: payload.mfa_policy || null,
      sessionExpiredMessage: null,
      status: payload.user ? 'authenticated' : 'guest',
      initialized: true,
    });
    if (payload.csrf_token) setCsrfToken(payload.csrf_token);
  },

  initialize: () => {
    if (get().initialized) return Promise.resolve();
    if (initializationPromise) return initializationPromise;
    set({ status: 'checking' });
    // React StrictMode mounts effects twice in development; restoring a
    // rotating refresh cookie twice would invalidate one of the requests.
    initializationPromise = (async () => {
      try {
        const payload = await fetchSessionWithRefresh();
        if (!payload?.user) throw new Error('No authenticated user returned.');
        // /auth/session does not include a CSRF token. Wait for /auth/csrf
        // before releasing guarded routes, especially the Paystack return page.
        if (!payload.csrf_token) await initialiseCsrfToken();
        if (!get().initialized) get().applyPayload(payload);
      } catch {
        if (!get().initialized) {
          setCsrfToken(null);
          set({ ...blankSession, status: 'guest', initialized: true });
        }
      }
    })().finally(() => { initializationPromise = null; });
    return initializationPromise;
  },

  refreshSessionState: async () => {
    const activeUserId = get().user?.id;
    if (get().status !== 'authenticated' || !activeUserId) return null;
    try {
      const payload = await fetchSessionWithRefresh();
      if (!payload?.user) throw new Error('No authenticated user returned.');
      // An in-flight poll must never re-authenticate after explicit sign-out.
      if (get().status === 'authenticated' && get().user?.id === activeUserId) {
        get().applyPayload(payload);
      }
      return payload;
    } catch (error) {
      if (error?.response?.status === 401
        && get().status === 'authenticated' && get().user?.id === activeUserId) {
        const message = getErrorMessage(error, 'Your session has expired. Please sign in again.');
        get().clearSession(message);
        redirectToLoginAfterSessionExpiry(message);
      }
      throw error;
    }
  },

  login: async (payload) => {
    try {
      const response = await authService.login(payload);
      const data = response.data?.data || {};
      if (data.mfa_required) {
        return {
          success: false, mfaRequired: true, challengeToken: data.challenge_token,
          expiresInSeconds: data.expires_in_seconds || 300,
        };
      }
      get().applyPayload(data);
      return { success: true, redirectTo: resolveAuthenticatedStartPath(data) };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Unable to sign in.') };
    }
  },

  verifyMfa: async (payload) => {
    try {
      const response = await authService.verifyMfa(payload);
      const data = response.data?.data || {};
      get().applyPayload(data);
      return { success: true, redirectTo: resolveAuthenticatedStartPath(data) };
    } catch (error) {
      return {
        success: false, error: getErrorMessage(error, 'Unable to verify your code.'),
        status: error?.response?.status || null,
      };
    }
  },

  googleLogin: async (payload) => {
    try {
      const response = await authService.googleLogin(payload);
      const data = response.data?.data || {};
      if (data.mfa_required) {
        return {
          success: false, mfaRequired: true, challengeToken: data.challenge_token,
          expiresInSeconds: data.expires_in_seconds || 300,
        };
      }
      get().applyPayload(data);
      return { success: true, data, redirectTo: resolveAuthenticatedStartPath(data) };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Google authentication was unsuccessful.') };
    }
  },

  register: async (payload) => {
    try {
      const response = await authService.register(payload);
      const data = response.data?.data || {};
      get().applyPayload(data);
      return {
        success: true,
        data,
        verificationUrl: data.development_verification_url || null,
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Unable to create your business account.') };
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Local session is still cleared when the server already ended it.
    } finally {
      setCsrfToken(null);
      set({ ...blankSession, status: 'guest', initialized: true });
    }
  },

  clearSession: (message = null) => {
    setCsrfToken(null);
    set({ ...blankSession, sessionExpiredMessage: message, status: 'guest', initialized: true });
  },

  isAuthenticated: () => get().status === 'authenticated' && Boolean(get().user),
  nextPath: () => resolveAuthenticatedStartPath(get()),
}));


const protectedWorkspacePaths = ['/app', '/platform', '/onboarding', '/subscription', '/security/mfa'];
const publicWorkspaceExceptionPaths = [
  '/platform/accept-invitation',
  '/accept-invitation',
  '/team/accept-invitation',
  '/portal',
  '/verify-email',
  '/check-email',
  '/forgot-password',
  '/reset-password',
];

const redirectToLoginAfterSessionExpiry = (message) => {
  if (typeof window === 'undefined') return;

  const currentPath = `${window.location.pathname}${window.location.search || ''}`;
  const isPublicException = publicWorkspaceExceptionPaths.some((path) => window.location.pathname.startsWith(path));
  const shouldRedirect = !isPublicException && protectedWorkspacePaths.some((path) => window.location.pathname.startsWith(path));
  if (!shouldRedirect) return;

  try {
    window.sessionStorage.setItem('digitalinvoice_session_expired_message', message || 'Your session has expired. Please sign in again.');
  } catch {
    // Ignore storage failures; the redirect is still enough.
  }

  const from = encodeURIComponent(currentPath);
  window.location.replace(`/login?reason=session_expired&from=${from}`);
};

registerSessionExpiredHandler((message) => {
  const sessionMessage = message || 'Your session has expired. Please sign in again.';
  useAuthStore.getState().clearSession(sessionMessage);
  redirectToLoginAfterSessionExpiry(sessionMessage);
});

registerMfaEnrollmentRequiredHandler((policy) => {
  useAuthStore.setState({ mfaPolicy: policy });
  if (typeof window !== 'undefined' && window.location.pathname !== '/security/mfa') {
    window.location.replace('/security/mfa');
  }
});

registerSessionRefreshedHandler((payload) => {
  const state = useAuthStore.getState();
  // Ignore late responses after sign-out or after a different user signed in.
  if (payload?.user && (state.status === 'checking'
    || (state.status === 'authenticated' && state.user?.id === payload.user.id))) {
    state.applyPayload(payload);
  }
});

export default useAuthStore;
