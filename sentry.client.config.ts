/**
 * sentry.client.config.ts
 *
 * Sentry browser-side initialisation.
 * This file runs in the user's browser, so use NEXT_PUBLIC_ env vars.
 *
 * Features enabled:
 *   - Error capture
 *   - Performance tracing (20% sample rate — adjust as needed)
 *   - Session Replay: records every session that contains an error (100%),
 *     and 5% of sessions without errors.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Percentage of transactions captured for performance monitoring (0.0–1.0)
  tracesSampleRate: 0.2,

  // Session Replay — capture all sessions where an error occurred
  replaysOnErrorSampleRate: 1.0,

  // Session Replay — capture 5% of all other sessions
  replaysSessionSampleRate: 0.05,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text & input values in replays for privacy (change to false only if needed)
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Silences Sentry console output during development
  debug: false,

  // Ignore non-actionable browser-generated noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
})
