'use client'

/**
 * components/sentry-user-provider.tsx
 *
 * A thin client component that syncs the authenticated Supabase user
 * to Sentry's user context so every error and replay is tagged with the
 * organiser's ID and email.
 *
 * Mount this once inside the root layout (inside ThemeProvider is fine).
 * It renders nothing to the DOM.
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/client'

export function SentryUserProvider() {
  useEffect(() => {
    const supabase = createClient()

    // Sync existing session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        Sentry.setUser({ id: user.id, email: user.email ?? undefined })
      }
    })

    // Keep Sentry user in sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email ?? undefined,
        })
      }

      if (event === 'SIGNED_OUT') {
        Sentry.setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Renders nothing — purely a side-effect component
  return null
}
