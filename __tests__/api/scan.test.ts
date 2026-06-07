/**
 * __tests__/api/scan.test.ts
 *
 * Unit tests for POST /api/scan — the QR code check-in endpoint.
 * All Supabase calls are mocked via createAdminClient.
 *
 * The route uses the admin client (service role) so there are no
 * RLS constraints to worry about at this layer — the route itself
 * enforces all business rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock admin client ──────────────────────────────────────────────────────

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/scan/route'

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

// ── Test data fixtures ─────────────────────────────────────────────────────

const SCANNER_TOKEN = 'tok_abc123'
const EVENT_ID = 'event-live-1'
const INVITATION_ID = 'inv-1'
const QR_TOKEN = 'qr-xyz'

const SCANNER_LINK = { id: 'link-1', event_id: EVENT_ID, label: 'Gate A', is_active: true }
const LIVE_EVENT = { status: 'live' }
const GUEST = { id: 'att-1', name: 'Alice Doe', email: 'alice@x.com', phone: null }
const TICKET_TIER = { id: 'tier-1', name: 'VIP' }

const VALID_INVITATION: {
  id: string
  event_id: string
  qr_token: string
  status: string
  checked_in_at: string | null
  party_size: number
  seat_info: string
  attendee: typeof GUEST
  ticket_tier: typeof TICKET_TIER
} = {
  id: INVITATION_ID,
  event_id: EVENT_ID,
  qr_token: QR_TOKEN,
  status: 'accepted',
  checked_in_at: null,
  party_size: 2,
  seat_info: 'Row A - 12',
  attendee: GUEST,
  ticket_tier: TICKET_TIER,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/scan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Build a mock Supabase chain that returns the given value at the end.
 * Covers: .from().select().eq().single()
 *         .from().update().eq().select().single()
 *         .from().insert()
 */
function makeChain(resolveWith: { data?: unknown; error?: unknown } = {}) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveWith),
  }
  return chain
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Input validation ─────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 when invitationId is missing', async () => {
      mockCreateAdminClient.mockReturnValue({ from: vi.fn() })

      const res = await POST(makeRequest({ scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/missing/i)
    })

    it('returns 400 when scannerToken is missing', async () => {
      mockCreateAdminClient.mockReturnValue({ from: vi.fn() })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/missing/i)
    })
  })

  // ── Scanner link validation ───────────────────────────────────────────────

  describe('scanner link validation', () => {
    it('returns 403 when scanner token is not found', async () => {
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => makeChain({ data: null, error: { message: 'Not found' } })),
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: 'bad-token' }))
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toMatch(/invalid scanner link/i)
    })

    it('returns 403 when scanner link is deactivated', async () => {
      const inactiveLink = { ...SCANNER_LINK, is_active: false }
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => makeChain({ data: inactiveLink, error: null })),
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toMatch(/deactivated/i)
    })
  })

  // ── Event status guards ───────────────────────────────────────────────────

  describe('event status guards', () => {
    function mockWithEvent(eventStatus: string) {
      let callCount = 0
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: { status: eventStatus }, error: null })
          return makeChain({ data: null, error: null })
        }),
      })
    }

    it('returns 403 when event status is "ended"', async () => {
      mockWithEvent('ended')
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(403)
      expect((await res.json()).error).toMatch(/ended/i)
    })

    it('returns 403 when event status is "draft"', async () => {
      mockWithEvent('draft')
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(403)
      expect((await res.json()).error).toMatch(/not yet open/i)
    })

    it('returns 403 when event status is "published" (not yet live)', async () => {
      mockWithEvent('published')
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(403)
      expect((await res.json()).error).toMatch(/not yet open/i)
    })
  })

  // ── QR token lookup ───────────────────────────────────────────────────────

  describe('QR token lookup', () => {
    function mockLiveEventThen(invChain: ReturnType<typeof makeChain>) {
      let callCount = 0
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: LIVE_EVENT, error: null })
          return invChain
        }),
      })
    }

    it('returns 404 when QR token does not match any invitation', async () => {
      mockLiveEventThen(makeChain({ data: null, error: { message: 'Not found' } }))

      const res = await POST(makeRequest({ invitationId: 'bad-qr', scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(404)
      expect((await res.json()).error).toMatch(/not found/i)
    })

    it('returns 400 when QR code belongs to a different event', async () => {
      const wrongEventInvitation = { ...VALID_INVITATION, event_id: 'event-other' }
      mockLiveEventThen(makeChain({ data: wrongEventInvitation, error: null }))

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/different event/i)
    })
  })

  // ── Invitation status guards ──────────────────────────────────────────────

  describe('invitation status guards', () => {
    function mockUpToInvitation(invitation: typeof VALID_INVITATION) {
      let callCount = 0
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: LIVE_EVENT, error: null })
          return makeChain({ data: invitation, error: null })
        }),
      })
    }

    it('returns 400 when invitation status is "cancelled"', async () => {
      mockUpToInvitation({ ...VALID_INVITATION, status: 'cancelled' })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/cancelled/i)
    })

    it('returns 409 when guest is already checked in (checked_in_at set)', async () => {
      mockUpToInvitation({
        ...VALID_INVITATION,
        checked_in_at: '2025-12-31T20:00:00Z',
        status: 'accepted',
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.error).toMatch(/already checked in/i)
      expect(json.alreadyEntered).toBe(true)
      expect(json.enteredAt).toBe('2025-12-31T20:00:00Z')
    })

    it('returns 409 when invitation status is already "checked_in"', async () => {
      mockUpToInvitation({
        ...VALID_INVITATION,
        checked_in_at: null,
        status: 'checked_in',
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(409)
      expect((await res.json()).alreadyEntered).toBe(true)
    })
  })

  // ── checkOnly mode ────────────────────────────────────────────────────────

  describe('checkOnly mode', () => {
    it('returns guest info without mutating when checkOnly=true', async () => {
      let callCount = 0
      const updateMock = vi.fn()
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: LIVE_EVENT, error: null })
          // Third call: invitation lookup
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: VALID_INVITATION, error: null }),
            update: updateMock,
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }),
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN, checkOnly: true }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.guest).toEqual(GUEST)
      expect(json.partySize).toBe(2)
      // update should NOT have been called
      expect(updateMock).not.toHaveBeenCalled()
    })
  })

  // ── Successful check-in ───────────────────────────────────────────────────

  describe('successful check-in', () => {
    it('records check-in and returns guest data on a valid scan', async () => {
      const checkedInInvitation = {
        ...VALID_INVITATION,
        status: 'checked_in',
        checked_in_at: '2025-12-31T21:00:00Z',
      }
      let callCount = 0
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn((table: string) => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: LIVE_EVENT, error: null })
          if (callCount === 3) return makeChain({ data: VALID_INVITATION, error: null }) // invitation lookup
          if (table === 'invitations') {
            // update chain: .update().eq().select().single()
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: checkedInInvitation, error: null }),
            }
          }
          // entry_logs insert
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }),
      })

      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.attendee).toEqual(GUEST)
      expect(json.partySize).toBe(2)
      expect(json.checkedInAt).toBe('2025-12-31T21:00:00Z')
      expect(json.tier).toEqual(TICKET_TIER)
    })
  })

  // ── DB trigger error handling ─────────────────────────────────────────────

  describe('DB trigger error handling (update step)', () => {
    function mockUpToUpdate(updateError: { message: string }) {
      let callCount = 0
      mockCreateAdminClient.mockReturnValue({
        from: vi.fn(() => {
          callCount++
          if (callCount === 1) return makeChain({ data: SCANNER_LINK, error: null })
          if (callCount === 2) return makeChain({ data: LIVE_EVENT, error: null })
          if (callCount === 3) return makeChain({ data: VALID_INVITATION, error: null })
          // update chain fails
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: updateError }),
          }
        }),
      })
    }

    it('returns 409 for "invitation_already_checked_in" trigger error', async () => {
      mockUpToUpdate({ message: 'invitation_already_checked_in' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/already checked in/i)
    })

    it('returns 422 for "invalid_status_transition" trigger error', async () => {
      mockUpToUpdate({ message: 'invalid_status_transition' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(422)
      expect((await res.json()).error).toMatch(/invalid status/i)
    })

    it('returns 409 for "tier_capacity_exceeded" trigger error', async () => {
      mockUpToUpdate({ message: 'tier_capacity_exceeded' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/full/i)
    })

    it('returns 422 for "tier_soft_deleted" trigger error', async () => {
      mockUpToUpdate({ message: 'tier_soft_deleted' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(422)
      expect((await res.json()).error).toMatch(/no longer available/i)
    })

    it('returns 403 for "scanner_write_restricted" trigger error', async () => {
      mockUpToUpdate({ message: 'scanner_write_restricted' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(403)
      expect((await res.json()).error).toMatch(/insufficient permissions/i)
    })

    it('returns 500 for an unexpected DB error', async () => {
      mockUpToUpdate({ message: 'connection refused' })
      const res = await POST(makeRequest({ invitationId: QR_TOKEN, scannerToken: SCANNER_TOKEN }))
      expect(res.status).toBe(500)
    })
  })
})
