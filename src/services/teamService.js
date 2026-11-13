import api from './api';

const teamService = {
  roles: () => api.get('/team/roles'),
  members: () => api.get('/team/members'),
  invite: (payload) => api.post('/team/invitations', payload),
  cancelInvitation: (invitationId) => api.delete('/team/invitations', { data: { id: invitationId } }),
  resendInvitation: (invitationId) => api.post('/team/invitations/resend', { id: invitationId }),
  validateInvitation: (token) => api.get('/team/invitations/validate', { params: { token } }),
  acceptInvitation: (payload) => api.post('/team/invitations/accept', payload, { skipAuthRefresh: true, skipCsrf: true }),
  updateRole: (payload) => api.put('/team/members/role', payload),
  updateStatus: (payload) => api.put('/team/members/status', payload),
};

export default teamService;
