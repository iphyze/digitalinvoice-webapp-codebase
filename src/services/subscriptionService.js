import api from './api';

const subscriptionService = {
  listPlans: () => api.get('/plans'),
  status: () => api.get('/subscriptions/status'),
  initialize: (planCode, action = 'subscribe') => api.post('/subscriptions/initialize', { plan_code: planCode, action }),
  verify: (reference) => api.post('/subscriptions/verify', { reference }),
  pendingPayment: () => api.get('/subscriptions/pending-payment'),
  checkPendingPayment: () => api.post('/subscriptions/pending-payment/check', {}),
  cancelPendingPayment: () => api.post('/subscriptions/pending-payment/cancel', {}),
  cancelRenewal: () => api.post('/subscriptions/cancel'),
  requestPremium: (payload) => api.post('/premium-requests', payload),
};

export default subscriptionService;
