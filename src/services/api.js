import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost/digitalinvoice-server/api',
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

let csrfToken = null;
let csrfInitialisationPromise = null;
let refreshPromise = null;
let onSessionExpired = () => {};
let onSessionRefreshed = () => {};
let onMfaEnrollmentRequired = () => {};

const AUTH_NO_REFRESH_ENDPOINTS = [
  '/auth/config',
  '/auth/csrf',
  '/auth/register',
  '/auth/verify-email',
  '/auth/login',
  '/auth/mfa/verify',
  '/auth/google',
  '/auth/refresh',
  '/auth/logout',
  '/auth/session',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/team/invitations/accept',
  '/platform/invitations/validate',
  '/platform/invitations/accept',
];

const unsafeRequest = (method = 'get') =>
  ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase());

const isPublicAuthEndpoint = (url = '') => AUTH_NO_REFRESH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

const sessionMessageFromError = (error, fallback = 'Your session has expired. Please sign in again.') => (
  error?.response?.data?.message
    || error?.message
    || fallback
);

const notifySessionExpired = (error) => {
  onSessionExpired(sessionMessageFromError(error));
};

export const registerMfaEnrollmentRequiredHandler = (handler) => {
  onMfaEnrollmentRequired = typeof handler === 'function' ? handler : () => {};
};

export const setCsrfToken = (token) => {
  csrfToken = typeof token === 'string' && token.length ? token : null;
};

export const registerSessionExpiredHandler = (handler) => {
  onSessionExpired = typeof handler === 'function' ? handler : () => {};
};

export const registerSessionRefreshedHandler = (handler) => {
  onSessionRefreshed = typeof handler === 'function' ? handler : () => {};
};

// A Paystack redirect reloads the app, clearing the in-memory token while the
// session cookies remain. Share one CSRF bootstrap across all pending requests
// so parallel calls cannot issue different tokens and race the cookie response.
export const initialiseCsrfToken = () => {
  if (!csrfInitialisationPromise) {
    csrfInitialisationPromise = api.get('/auth/csrf', { skipAuthRefresh: true, skipCsrf: true })
      .then((response) => {
        setCsrfToken(response.data?.data?.csrf_token);
        if (!csrfToken) throw new Error('Unable to initialize the session security token.');
        return csrfToken;
      })
      .finally(() => { csrfInitialisationPromise = null; });
  }
  return csrfInitialisationPromise;
};

/*
  Session refresh coordination.

  The backend rotates the refresh cookie on every refresh, and all tabs share the
  same cookies. Two refreshes that overlap (two tabs whose access tokens expire
  together, or a retry on a slow network) present the same refresh token; only the
  first may rotate it. So:
  - within a tab, every caller shares one in-flight refresh (refreshPromise);
  - across tabs, refreshes take turns through the Web Locks API;
  - a tab that gets the lock just after another tab refreshed reuses that result
    (the new cookies are already in the browser) instead of refreshing again;
  - the backend answers a just-rotated token with 409 `refresh_superseded`, which
    is handled the same way: never as a sign-out.
*/
const REFRESH_LOCK_NAME = 'digitalinvoice-auth-refresh';
const REFRESHED_AT_KEY = 'digitalinvoice-auth-refreshed-at';
const RECENT_REFRESH_MS = 15_000;

const readLastRefreshAt = () => {
  try {
    return Number(window.localStorage.getItem(REFRESHED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
};

const markRefreshed = () => {
  try {
    window.localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode): the backend grace window still protects the session.
  }
};

const applyRefreshedPayload = (response) => {
  const payload = response.data?.data || {};
  if (payload.csrf_token) setCsrfToken(payload.csrf_token);
  onSessionRefreshed(payload);
  return response;
};

// Another tab (or request) already refreshed: pick up the CSRF token and session
// that belong to the cookies now in the browser.
const adoptCurrentSession = async () => {
  await initialiseCsrfToken();
  const response = await api.get('/auth/session', { skipAuthRefresh: true });
  return applyRefreshedPayload(response);
};

const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

const performRefresh = async () => {
  if (Date.now() - readLastRefreshAt() < RECENT_REFRESH_MS) {
    try {
      return await adoptCurrentSession();
    } catch {
      // Fall through to a real refresh if the shared session isn't usable.
    }
  }
  if (!csrfToken) await initialiseCsrfToken();
  try {
    const response = await api.post('/auth/refresh', {}, { skipAuthRefresh: true });
    markRefreshed();
    return applyRefreshedPayload(response);
  } catch (error) {
    if (error.response?.status === 409 && error.response?.data?.code === 'refresh_superseded') {
      // The winning refresh's cookies may still be landing; give them a moment.
      await wait(300);
      return adoptCurrentSession();
    }
    throw error;
  }
};

// All refresh callers (automatic retries, keep-alive and session restoration)
// share the same request, and tabs take turns.
export const refreshAuthenticatedSession = async () => {
  if (!refreshPromise) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const run = locks?.request
      ? locks.request(REFRESH_LOCK_NAME, () => performRefresh())
      : performRefresh();
    refreshPromise = run.finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

api.interceptors.request.use(async (config) => {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (!isFormData && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  if (unsafeRequest(config.method) && !config.skipCsrf) {
    // Never send a protected write before the CSRF header is ready. This also
    // covers POST /subscriptions/verify immediately after returning from Paystack.
    if (!csrfToken) await initialiseCsrfToken();
    config.headers.Authorization = `Bearer ${csrfToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config || {};
    const requestUrl = request.url || '';
    const skipRefresh = request.skipAuthRefresh || isPublicAuthEndpoint(requestUrl);
    if (error.response?.status === 403 && error.response?.data?.code === 'mfa_enrollment_required') {
      onMfaEnrollmentRequired(error.response.data.mfa_policy);
      return Promise.reject(error);
    }

    if (error.response?.status === 419 && !request._csrfRetry && !request.skipCsrf) {
      request._csrfRetry = true;
      try {
        await initialiseCsrfToken();
        return api(request);
      } catch (csrfError) {
        setCsrfToken(null);
        onSessionExpired();
        return Promise.reject(csrfError);
      }
    }

    if (error.response?.status === 401 && (request._authRetry || skipRefresh)) {
      if (!isPublicAuthEndpoint(requestUrl)) {
        notifySessionExpired(error);
      }
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    request._authRetry = true;
    try {
      await refreshAuthenticatedSession();
      return api(request);
    } catch (refreshError) {
      setCsrfToken(null);
      notifySessionExpired(refreshError);
      return Promise.reject(refreshError);
    }
  },
);

export default api;
