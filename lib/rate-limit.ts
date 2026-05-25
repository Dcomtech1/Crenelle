/**
 * lib/rate-limit.ts
 *
 * Lightweight in-process sliding-window rate limiter.
 * Uses a module-level Map — persists across requests within the same
 * Node.js process (i.e. the same serverless function warm instance).
 *
 * Good enough for a single-region deployment. If you scale to multiple
 * instances or regions, swap the store for a Supabase KV / Redis / Upstash
 * adapter without changing the call sites.
 */

interface WindowEntry {
  count: number
  resetAt: number
}

// Module-level store — lives for the lifetime of the warm lambda
const store = new Map<string, WindowEntry>()

// Clean up expired keys periodically so the map doesn't grow unbounded
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key)
  }
}

export interface RateLimitOptions {
  /** Unique key for this counter — e.g. `register:${ip}` or `register:${email}` */
  key: string
  /** Maximum number of requests allowed within the window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** true if the request is within the allowed limit */
  allowed: boolean
  /** remaining requests in this window */
  remaining: number
  /** timestamp (ms) when the window resets */
  resetAt: number
}

/**
 * Check whether a key is within its rate limit.
 * Call this at the top of any server action or API route you want to guard.
 *
 * @example
 * const { allowed } = checkRateLimit({ key: `reg:${email}`, limit: 3, windowMs: 60_000 })
 * if (!allowed) return { error: 'Too many requests — please wait a moment.' }
 */
export function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // First request in this window
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}
