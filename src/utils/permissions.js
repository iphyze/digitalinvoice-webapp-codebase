export const hasPermission = (permissions = [], permission) =>
  Array.isArray(permissions) && (permissions.includes('*') || permissions.includes(permission));

export const canAccessAny = (permissions = [], expected = []) =>
  expected.some((permission) => hasPermission(permissions, permission));
