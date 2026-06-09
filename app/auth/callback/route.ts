import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/events'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page, settings, or login page if exchange fails
  if (next && next.startsWith('/settings')) {
    const divider = next.includes('?') ? '&' : '?'
    return NextResponse.redirect(`${origin}${next}${divider}error=OAuth exchange failed`)
  }

  return NextResponse.redirect(`${origin}/login?error=OAuth exchange failed`)
}
