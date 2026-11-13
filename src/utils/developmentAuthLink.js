/**
 * Convert a development-only backend link into a local frontend route.
 * Never navigate to an origin supplied by the API; use only the expected path
 * and its opaque token. Production APIs do not return these links.
 */
export function developmentAuthPath(url, pathname) {
  if (!url || !['/verify-email', '/reset-password'].includes(pathname)) return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== pathname) return null
    const token = parsed.searchParams.get('token')
    return token ? `${pathname}?token=${encodeURIComponent(token)}` : null
  } catch {
    return null
  }
}
