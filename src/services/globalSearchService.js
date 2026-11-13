import api from './api';

const globalSearchService = {
  workspace: (params = {}) => api.get('/global-search', { params }),
  platform: (params = {}) => api.get('/platform/search', { params }),
};

export default globalSearchService;
