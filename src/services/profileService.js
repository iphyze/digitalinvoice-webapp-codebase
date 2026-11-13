import api from './api';

const profileService = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (payload) => api.put('/user/profile', payload),
  changePassword: (payload) => api.put('/user/password', payload),
};

export default profileService;
