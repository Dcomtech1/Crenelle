import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase Auth proxy — two responsibilities:
 *
 * 1. TOKEN REFRESH: Supabase issues short-lived access tokens (~1 hr).
 *    Without this proxy, an expired token cannot be silently refreshed
 *    from a Server Component because cookies can't be written in that context.
 *    The proxy runs at the edge *before* rendering and can write the new
 *    session cookies back into the response, keeping the user logged in.
 *
 * 2. ROUTE PROTECTION: Redirect unauthenticated users trying to reach
 *    protected routes. This is a first-line guard; layouts still call
 *    getUser() as defence-in-depth (RLS is the final layer).
 *
 * ⚠️  Do NOT simplify the cookie setAll logic.
 *    Cookies must be written on *both* the request and response objects
 *    for token refresh to propagate correctly (@supabase/ssr requirement).
 */
export async function proxy(request: NextRequest) {
  // Start with a passthrough response that preserves the incoming request
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write onto request so downstream Server Components see the refresh
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate response with updated request context
          supabaseResponse = NextResponse.next({ request })
          // Write onto response so the browser receives the refreshed cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the token against Supabase Auth's server and triggers
  // a refresh if the access token has expired. Do NOT use getSession() here —
  // that skips server-side validation and can return stale/revoked sessions.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Route protection ────────────────────────────────────────────────────
  // Unauthenticated users hitting any protected prefix are redirected to /login.
  // The `next` param lets the login page send them back after they authenticate.
  const isProtected =
    pathname.startsWith('/events') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/admin')

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated redirect ───────────────────────────────────────────────
  // Logged-in users hitting /login or /signup are sent straight to /events
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const eventsUrl = request.nextUrl.clone()
    eventsUrl.pathname = '/events'
    return NextResponse.redirect(eventsUrl)
  }

  // Return the (possibly cookie-updated) response
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static / _next/image  — Next.js build assets
     * - favicon.ico                 — browser tab icon
     * - common static image types   — served directly
     * - /register/*                 — public event registration (no login)
     * - /scan/*                     — public QR scanner pages (token-auth, no login)
     * - /api/scan                   — scanner check-in API (token-authenticated)
     * - /api/register               — public registration submission API
     * - /api/unsubscribe            — email unsubscribe API (token link)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|register|scan|api/scan|api/register|api/unsubscribe).*)',
  ],
}
