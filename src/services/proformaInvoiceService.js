import api from './api';

const proformaInvoiceService = {
  list: (params) => api.get('/proforma-invoices', { params }),
  show: (id) => api.get('/proforma-invoices/show', { params: { id } }),
  document: (id) => api.get('/proforma-invoices/document', { params: { id } }),
  create: (payload) => api.post('/proforma-invoices', payload),
  update: (payload) => api.put('/proforma-invoices', payload),
  archive: (id) => api.delete('/proforma-invoices', { data: { id } }),
  sendToCustomer: (payload) => api.post('/proforma-invoices/send', payload),
};

export default proformaInvoiceService;
