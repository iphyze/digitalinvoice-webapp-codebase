import api from './api';

const dashboardService = {
  summary: (params) => api.get('/dashboard/summary', { params }),
  trends: (params) => api.get('/dashboard/trends', { params }),
  recentActivity: (params) => api.get('/dashboard/recent-activity', { params }),
};

export default dashboardService;
