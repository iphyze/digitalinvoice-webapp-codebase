import api from './api';

const reportService = {
  invoices: (params) => api.get('/reports/invoices', { params }),
  payments: (params) => api.get('/reports/payments', { params }),
  receivablesAging: (params) => api.get('/reports/receivables-aging', { params }),
  customerStatement: (params) => api.get('/reports/customer-statement', { params }),
  sendCustomerStatement: (payload) => api.post('/reports/customer-statement/send', payload),
  vatSummary: (params) => api.get('/reports/vat-summary', { params }),
  complianceReadiness: () => api.get('/reports/compliance-readiness'),
  firsReadiness: () => api.get('/firs/status'),
};

export default reportService;
