import { canAccessAny } from './permissions.js';
import { hasAnyEntitledPermission } from './entitlements.js';

const itemPermissions = (item) => item.permissions || (item.permission ? [item.permission] : []);

// Never expose a route when its required role or permission is absent.
// A missing plan entitlement, however, can be shown as an upgrade destination:
// the existing route guard still enforces the subscription restrictions.
export function canSeeNav(permissions, item, role) {
  if (item.roles && !item.roles.includes(String(role || '').toLowerCase())) return false;
  const expected = itemPermissions(item);
  return expected.length === 0 || canAccessAny(permissions, expected);
}

export function navigationNeedsUpgrade(entitlements, item) {
  if (item.entitlementKeys?.length) {
    return !item.entitlementKeys.some((key) => Boolean(entitlements?.features?.[key]));
  }
  return !hasAnyEntitledPermission(entitlements, itemPermissions(item));
}

export function filterNav(items, permissions, entitlements, role) {
  return items.flatMap((item) => {
    if (!canSeeNav(permissions, item, role)) return [];
    if (item.children) {
      const children = filterNav(item.children, permissions, entitlements, role);
      return children.length ? [{ ...item, children }] : [];
    }
    return [{ ...item, planLocked: navigationNeedsUpgrade(entitlements, item) }];
  });
}
