import api from './api';

const invoiceService = {
  list: (params) => api.get('/invoices', { params }),
  show: (id) => api.get('/invoices/show', { params: { id } }),
  document: (id) => api.get('/invoices/document', { params: { id } }),
  calculate: (payload) => api.post('/invoices/calculate', payload),
  create: (payload) => api.post('/invoices', payload),
  update: (payload) => api.put('/invoices', payload),
  archive: (id) => api.delete('/invoices', { data: { id } }),
  submitForApproval: (id) => api.post('/invoices/submit-for-approval', { id }),
  approve: (id) => api.post('/invoices/approve', { id }),
  returnForCorrection: (id, reason) => api.post('/invoices/reject', { id, reason }),
  sendToCustomer: (payload) => api.post('/invoices/send', payload),
  organizationLogo: () => api.get('/organization/logo', { responseType: 'blob' }),
  outstanding: (params) => api.get('/invoices/outstanding', { params }),
  prepareFirsReadiness: (id) => api.post('/firs/invoice-readiness', { invoice_id: id }),
};

export default invoiceService;
