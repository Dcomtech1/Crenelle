import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  /* config options here */
}

export default withSentryConfig(nextConfig, {
  // Sentry org and project — set these in CI/CD env or .env.local
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads (generate at https://sentry.io/settings/auth-tokens/)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only during production builds
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production',
  },

  // Hides source maps from the browser (they're uploaded to Sentry, not served publicly)
  hideSourceMaps: true,

  // Suppresses Sentry CLI log output during builds
  silent: !process.env.CI,

  // Automatically instrument Next.js Data Fetching methods
  autoInstrumentServerFunctions: true,

  // Disable the Sentry tunnel route (/monitoring) — add it if you hit ad-blocker issues
  tunnelRoute: undefined,
})
