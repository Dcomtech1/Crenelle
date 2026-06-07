/**
 * sentry.edge.config.ts
 *
 * Sentry Edge Runtime initialisation.
 * Used by Next.js middleware and edge routes.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: 0.2,

  debug: false,
})
