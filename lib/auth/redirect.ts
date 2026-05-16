/**
 * Redirect URL for Supabase email links (signup confirm, magic link).
 * Must be listed in Supabase Dashboard → Authentication → URL Configuration
 * → Redirect URLs (e.g. http://localhost:3000/auth/callback).
 */
export function getEmailRedirectUrl(nextPath = '/'): string {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (site) {
    return `${site}/auth/callback?next=${encodeURIComponent(next)}`
  }

  return `http://localhost:3000/auth/callback?next=${encodeURIComponent(next)}`
}
