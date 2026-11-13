import api from './api';

const mfaService = {
  status: () => api.get('/user/mfa'),
  setup: (currentPassword) => api.post('/user/mfa-setup', { current_password: currentPassword }),
  confirm: (code) => api.post('/user/mfa-confirm', { code }),
  disable: (currentPassword, code) => api.post('/user/mfa-disable', { current_password: currentPassword, code }),
  regenerate: (currentPassword, code) => api.post('/user/mfa-recovery-regenerate', { current_password: currentPassword, code }),
};

export default mfaService;
