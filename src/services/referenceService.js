import api from './api';

const referenceService = {
  units: () => api.get('/reference/units'),
  createUnit: (payload) => api.post('/reference/units', payload),
  taxRates: (params) => api.get('/reference/tax-rates', { params }),
  createTaxRate: (payload) => api.post('/reference/tax-rates', payload),
  updateTaxRate: (payload) => api.put('/reference/tax-rates', payload),
};

export default referenceService;
