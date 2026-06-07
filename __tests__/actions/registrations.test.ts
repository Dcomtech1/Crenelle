/**
 * __tests__/actions/registrations.test.ts
 *
 * Integration tests for the public registration server actions.
 * Supabase clients are fully mocked — no real DB calls are made.
 *
 * Strategy: vi.mock() at file level keeps the mock factory registered.
 * Each test re-assigns the mock return value to control per-test behaviour.
 * No vi.resetModules() is used (it breaks vi.mock registration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ── Mock declarations (at file scope) ─────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendReminderEmailsDirect: vi.fn().mockResolvedValue({ sent: 1, errors: [] }),
}))
vi.mock('@/lib/whatsapp', () => ({
  sendInvitationWhatsApp: vi.fn().mockResolvedValue({ success: true }),
}))

// Import actions AFTER mocks are registered so they pick up mocked modules
import {
  submitRegistration,
  acceptRegistration,
  rejectRegistration,
  promoteFromWaitlist,
} from '@/app/actions/registrations'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
  return fd
}

// Use unique emails per test to prevent in-memory rate-limit state from bleeding between tests.
let emailCounter = 0
function uniqueEmail() {
  emailCounter++
  return `test-${emailCounter}-${Date.now()}@x.com`
}

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>
const mockCreateClient = createClient as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ── submitRegistration ─────────────────────────────────────────────────────

describe('submitRegistration', () => {
  it('returns { error } when the event is not found', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    })

    const fd = makeFormData({ email: uniqueEmail(), full_name: 'Test User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'Event not found' })
  })

  it('returns { error } for a draft event', async () => {
    const mockEvent = { id: 'event-1', event_type: 'open', status: 'draft', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
        not: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const fd = makeFormData({ email: uniqueEmail(), full_name: 'Test User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'Registration is not yet open for this event' })
  })

  it('returns { error } for an ended event', async () => {
    const mockEvent = { id: 'event-1', event_type: 'open', status: 'ended', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      }),
    })

    const fd = makeFormData({ email: uniqueEmail(), full_name: 'Test User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'This event has ended' })
  })

  it('returns { error } for a closed (non-open) event', async () => {
    const mockEvent = { id: 'event-1', event_type: 'closed', status: 'published', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      }),
    })

    const fd = makeFormData({ email: uniqueEmail(), full_name: 'Test User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'This event does not accept public registrations' })
  })

  it('returns { error } when name or email is missing', async () => {
    const mockEvent = { id: 'event-1', event_type: 'open', status: 'published', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          count: null,
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    })

    const fd = makeFormData({ email: '', full_name: '' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'Name and email are required' })
  })

  it('returns { error } on duplicate insert (code 23505)', async () => {
    const mockEvent = { id: 'event-1', event_type: 'open', status: 'published', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }
        }
        if (table === 'email_unsubscribes') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        // attendees insert — duplicate error
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          count: 0,
          insert: vi.fn().mockResolvedValue({ error: { message: 'duplicate', code: '23505' } }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    })

    const fd = makeFormData({ email: 'dup@x.com', full_name: 'Dup User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ error: 'You have already registered for this event with this email' })
  })

  it('returns { success: true } silently for unsubscribed emails', async () => {
    const mockEvent = { id: 'event-1', event_type: 'open', status: 'published', max_registrations: null }
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
          }
        }
        if (table === 'email_unsubscribes') {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'unsub-1' }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          count: 0,
        }
      }),
    })

    const fd = makeFormData({ email: 'unsub@x.com', full_name: 'Unsub User' })
    const result = await submitRegistration('event-1', fd)
    expect(result).toEqual({ success: true })
  })
})

// ── acceptRegistration ─────────────────────────────────────────────────────

describe('acceptRegistration', () => {
  it('returns { error: "Already accepted" } for already-accepted attendees', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'attendees') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'att-1', registration_status: 'accepted', email: 'a@x.com', name: 'A', phone: null, ticket_tier_id: null },
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    })

    const result = await acceptRegistration('att-1', 'event-1')
    expect(result).toEqual({ error: 'Already accepted' })
  })

  it('returns { error } when attendee is not found', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })),
    })

    const result = await acceptRegistration('missing-att', 'event-1')
    expect(result).toEqual({ error: 'Registrant not found' })
  })
})

// ── rejectRegistration ─────────────────────────────────────────────────────

describe('rejectRegistration', () => {
  it('returns { success } on successful rejection', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'attendees') {
          // .update({}).eq() terminates — resolve with no error
          const eqMock = vi.fn().mockResolvedValue({ error: null })
          return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
        }
        if (table === 'events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { max_registrations: null }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    })

    const result = await rejectRegistration('att-1', 'event-1')
    expect(result).toEqual({ success: true })
  })

  it('returns { error } when DB update fails', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        const eqMock = vi.fn().mockResolvedValue({ error: { message: 'DB error' } })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
    })

    const result = await rejectRegistration('att-1', 'event-1')
    expect(result).toEqual({ error: 'DB error' })
  })
})

// ── promoteFromWaitlist ─────────────────────────────────────────────────────

describe('promoteFromWaitlist', () => {
  it('returns { error } when event is at capacity', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { max_registrations: 10 }, error: null }),
          }
        }
        // attendees count query — returns count=10 meaning at cap
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          count: 10,
        }
      }),
    })

    const result = await promoteFromWaitlist('att-1', 'event-1')
    expect(result).toEqual({ error: expect.stringContaining('No capacity') })
  })
})
