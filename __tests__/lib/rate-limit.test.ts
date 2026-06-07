import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// We need to control Date.now() to test window resets
// The module-level store is reset between tests via isolateModules

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('allows the first request and returns correct remaining count', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const result = checkRateLimit({ key: 'test:1', limit: 5, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks subsequent requests within the window', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    checkRateLimit({ key: 'track:1', limit: 3, windowMs: 60_000 })
    checkRateLimit({ key: 'track:1', limit: 3, windowMs: 60_000 })
    const third = checkRateLimit({ key: 'track:1', limit: 3, windowMs: 60_000 })
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(0)
  })

  it('blocks requests that exceed the limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const key = 'exceed:1'
    for (let i = 0; i < 3; i++) checkRateLimit({ key, limit: 3, windowMs: 60_000 })
    const over = checkRateLimit({ key, limit: 3, windowMs: 60_000 })
    expect(over.allowed).toBe(false)
    expect(over.remaining).toBe(0)
  })

  it('resets the counter after the window expires', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const key = 'reset:1'
    for (let i = 0; i < 3; i++) checkRateLimit({ key, limit: 3, windowMs: 10_000 })
    const blocked = checkRateLimit({ key, limit: 3, windowMs: 10_000 })
    expect(blocked.allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(11_000)

    const after = checkRateLimit({ key, limit: 3, windowMs: 10_000 })
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(2)
  })

  it('independent keys do not interfere with each other', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    for (let i = 0; i < 3; i++) checkRateLimit({ key: 'keyA', limit: 3, windowMs: 60_000 })
    checkRateLimit({ key: 'keyA', limit: 3, windowMs: 60_000 }) // blocked

    const keyB = checkRateLimit({ key: 'keyB', limit: 3, windowMs: 60_000 })
    expect(keyB.allowed).toBe(true)
    expect(keyB.remaining).toBe(2)
  })

  it('returns a resetAt timestamp in the future', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const now = Date.now()
    const result = checkRateLimit({ key: 'ts:1', limit: 5, windowMs: 30_000 })
    expect(result.resetAt).toBeGreaterThan(now)
  })
})
