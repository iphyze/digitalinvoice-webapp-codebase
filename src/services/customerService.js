import api from './api';

const customerService = {
  list: (params) => api.get('/customers', { params }),
  show: (id) => api.get('/customers/show', { params: { id } }),
  create: (payload) => api.post('/customers', payload),
  update: (payload) => api.put('/customers', payload),
  archive: (id) => api.delete('/customers', { data: { id } }),
};

export default customerService;
