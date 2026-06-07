/**
 * sentry.server.config.ts
 *
 * Sentry Node.js server-side initialisation (Next.js App Router RSC / Route Handlers / Server Actions).
 * Use SENTRY_DSN (not NEXT_PUBLIC_) so the key is never shipped to the browser.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture 20% of server transactions for performance monitoring
  tracesSampleRate: 0.2,

  debug: false,
})
