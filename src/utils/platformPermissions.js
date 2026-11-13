/** Presentation-only checks. PHP remains authoritative for platform authorisation. */
export const platformPermission = (access, user, name) => {
  const permissions = access?.permissions
  if (Array.isArray(permissions)) return permissions.includes('*') || permissions.includes(name)
  // Older platform_admin sessions use a legacy owner role.
  return user?.role === 'platform_admin'
}
