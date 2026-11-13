import api, { refreshAuthenticatedSession } from './api';

const authService = {
  getConfig: () => api.get('/auth/config', { skipAuthRefresh: true }),
  session: (config = {}) => api.get('/auth/session', config),
  refresh: () => refreshAuthenticatedSession(),
  register: (payload) => api.post('/auth/register', payload, { skipAuthRefresh: true, skipCsrf: true }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }, { skipAuthRefresh: true, skipCsrf: true }),
  resendVerification: () => api.post('/auth/resend-verification', {}),
  login: (payload) => api.post('/auth/login', payload, { skipAuthRefresh: true, skipCsrf: true }),
  verifyMfa: (payload) => api.post('/auth/mfa/verify', payload, { skipAuthRefresh: true, skipCsrf: true }),
  googleLogin: (payload) => api.post('/auth/google', payload, { skipAuthRefresh: true, skipCsrf: true }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }, { skipAuthRefresh: true, skipCsrf: true }),
  resetPassword: (payload) => api.post('/auth/reset-password', payload, { skipAuthRefresh: true, skipCsrf: true }),
  logout: () => api.post('/auth/logout', {}, { skipAuthRefresh: true }),
  requestDemo: (payload) => api.post('/demo/request', payload, { skipAuthRefresh: true, skipCsrf: true }),
};

export default authService;
