import api from './api';

const onboardingService = {
  status: () => api.get('/onboarding/status'),
  complete: () => api.post('/onboarding/complete', {}),
  getProfile: () => api.get('/organization/profile'),
  updateProfile: (payload) => api.put('/organization/profile', payload),
  getInvoiceSettings: () => api.get('/organization/invoice-settings'),
  updateInvoiceSettings: (payload) => api.put('/organization/invoice-settings', payload),
  getComplianceProfile: () => api.get('/organization/compliance-profile'),
  updateComplianceProfile: (payload) => api.put('/organization/compliance-profile', payload),
  getBankAccounts: () => api.get('/organization/bank-accounts'),
  addBankAccount: (payload) => api.post('/organization/bank-accounts', payload),
  updateBankAccount: (payload) => api.put('/organization/bank-accounts', payload),
  removeBankAccount: (id) => api.delete('/organization/bank-accounts', { data: { id } }),
  uploadLogo: (file) => {
    const body = new FormData();
    body.append('logo', file);
    return api.post('/organization/logo', body);
  },
  removeLogo: () => api.delete('/organization/logo'),
  archiveAccount: (payload) => api.put('/organization/account', payload),
};

export default onboardingService;
