import api from './api';

const itemService = {
  list: (params) => api.get('/items', { params }),
  show: (id) => api.get('/items/show', { params: { id } }),
  create: (payload) => api.post('/items', payload),
  update: (payload) => api.put('/items', payload),
  archive: (id) => api.delete('/items', { data: { id } }),
};

export default itemService;
