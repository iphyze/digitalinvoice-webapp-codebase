import api from './api';

const deliveryNoteService = {
  list: (params) => api.get('/delivery-notes', { params }),
  show: (id) => api.get('/delivery-notes/show', { params: { id } }),
  document: (id) => api.get('/delivery-notes/document', { params: { id } }),
  sourceInvoice: (invoiceId) => api.get('/delivery-notes/source-invoice', { params: { invoice_id: invoiceId } }),
  create: (payload) => api.post('/delivery-notes', payload),
  update: (payload) => api.put('/delivery-notes', payload),
  archive: (id) => api.delete('/delivery-notes', { data: { id } }),
  sendToCustomer: (payload) => api.post('/delivery-notes/send', payload),
};

export default deliveryNoteService;
