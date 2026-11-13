import api from './api';

const firsService = {
  options: () => api.get('/firs/options'),
  status: () => api.get('/firs/status'),
  classificationCodes: (kind) => api.get('/firs/classification-codes', { params: { kind } }),
  submissionQueue: (invoiceId) => api.get('/firs/submission-queue', { params: invoiceId ? { invoice_id: invoiceId } : {} }),
  invoiceReadiness: (invoiceId) => api.post('/firs/invoice-readiness', { invoice_id: invoiceId }),
};

export default firsService;
