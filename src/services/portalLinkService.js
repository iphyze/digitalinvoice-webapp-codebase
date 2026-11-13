import api from './api';

const publicRequestConfig = { skipAuthRefresh: true, skipCsrf: true };

const portalLinkService = {
  list: (params) => api.get('/portal-links', { params }),
  create: (payload) => api.post('/portal-links', payload),
  revoke: (id) => api.post('/portal-links/revoke', { id }),
  access: (token, options = {}) => api.get('/public/customer-portal', {
    params: { token, track: options.track === false ? '0' : '1' },
    ...publicRequestConfig,
  }),
};

export default portalLinkService;
