import api from './api';

const activityService = {
  list(params = {}) {
    return api.get('/activity-log', { params });
  },
};

export default activityService;
