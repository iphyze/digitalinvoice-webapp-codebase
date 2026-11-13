import api from './api';

const creditNoteService = {
  list: (params) => api.get('/credit-notes', { params }),
  show: (id) => api.get('/credit-notes/show', { params: { id } }),
  document: (id) => api.get('/credit-notes/document', { params: { id } }),
  sourceInvoice: (invoiceId) => api.get('/credit-notes/source-invoice', { params: { invoice_id: invoiceId } }),
  create: (payload) => api.post('/credit-notes', payload),
  update: (payload) => api.put('/credit-notes', payload),
  archive: (id) => api.delete('/credit-notes', { data: { id } }),
  submitForApproval: (id) => api.post('/credit-notes/submit-for-approval', { id }),
  approve: (id) => api.post('/credit-notes/approve', { id }),
  returnForCorrection: (id, reason) => api.post('/credit-notes/reject', { id, reason }),
  sendToCustomer: (payload) => api.post('/credit-notes/send', payload),
  organizationLogo: () => api.get('/organization/logo', { responseType: 'blob' }),
  prepareNrsReadiness: (id) => api.post('/firs/credit-note-readiness', { credit_note_id: id }),
};

export default creditNoteService;
