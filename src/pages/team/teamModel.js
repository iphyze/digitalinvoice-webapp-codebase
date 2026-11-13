// Backend-aligned organisation team adapters; no display or permission state is persisted.
export const unwrapTeam = (response) => {
  const data = response?.data?.data
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.pending_invitations)) {
    throw new Error('Team response was incomplete. Please retry.')
  }
  return {
    members: data.members,
    invitations: data.pending_invitations,
    roles: data.assignable_roles && typeof data.assignable_roles === 'object' ? data.assignable_roles : {},
  }
}

export const canManageTeam = (role) => role === 'owner' || role === 'admin'
export const canModifyMember = (actor, member) => {
  if (!canManageTeam(actor?.role) || !member || Number(member.id) === Number(actor?.id)) return false
  if (member.role === 'owner') return false
  if (member.role === 'admin' && actor.role !== 'owner') return false
  return true
}
export const availableRoles = (roles) => Object.entries(roles || {}).map(([value, info]) => ({
  value, label: info?.label || value.replaceAll('_', ' '), description: info?.description || '',
}))
export const validateInvitation = (form, roles) => {
  const errors = {}
  const email = String(form?.email || '').trim()
  const name = String(form?.name || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  if (name.length > 120) errors.name = 'Name must be no longer than 120 characters.'
  if (!Object.prototype.hasOwnProperty.call(roles || {}, form?.role)) errors.role = 'Choose an available role.'
  return errors
}
export const dateLabel = (value) => {
  if (!value) return '—'
  const valueText = String(value).replace(' ', 'T')
  const date = new Date(valueText)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
