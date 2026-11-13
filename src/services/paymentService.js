import api from './api';

const paymentService = {
  list: (params) => api.get('/payments', { params }),
  show: (id) => api.get('/payments/show', { params: { id } }),
  document: (id) => api.get('/payments/document', { params: { id } }),
  sendToCustomer: (payload) => api.post('/payments/send', payload),
  organizationLogo: () => api.get('/organization/logo', { responseType: 'blob' }),
  record: (payload) => api.post('/payments', payload),
  allocate: (payload) => api.post('/payments/allocate', payload),
  void: (payload) => api.post('/payments/void', payload),
};

export default paymentService;
