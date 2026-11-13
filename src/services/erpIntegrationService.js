import api from './api';

// These are cookie + CSRF-protected workspace administration routes, never ERP bearer-token routes.
const erpIntegrationService = {
  clients: () => api.get('/integrations/clients'),
  createClient: (payload) => api.post('/integrations/clients', payload),
  updateClient: (payload) => api.put('/integrations/clients', payload),
  webhooks: () => api.get('/integrations/webhooks'),
  createWebhook: (payload) => api.post('/integrations/webhooks', payload),
  updateWebhook: (payload) => api.put('/integrations/webhooks', payload),
  deliveries: () => api.get('/integrations/webhooks/deliveries'),
};

export default erpIntegrationService;
