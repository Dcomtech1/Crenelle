/**
 * __tests__/actions/events.test.ts
 *
 * Integration tests for event server actions.
 * Supabase client is mocked at file scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

// ── Mock declarations ──────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// Import actions AFTER mocks are registered
import {
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
} from '@/app/actions/events'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
  return fd
}

const baseEventForm = {
  name: 'Test Event',
  date: '2025-12-31',
  time: '18:00',
  venue: 'Victoria Island',
  description: 'A great event',
  event_type: 'closed',
}

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ── createEvent ────────────────────────────────────────────────────────────

describe('createEvent', () => {
  it('redirects to event page on success', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'event-abc' }, error: null }),
      })),
    })

    const fd = makeFormData(baseEventForm)
    // redirect() throws a NEXT_REDIRECT error (stubbed in vitest.setup.ts)
    await expect(createEvent(fd)).rejects.toThrow('NEXT_REDIRECT:/events/event-abc')
  })

  it('returns { error } when DB insert fails', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    })

    const fd = makeFormData(baseEventForm)
    const result = await createEvent(fd)
    expect(result).toEqual({ error: 'DB error' })
  })

  it('redirects to /login when no user session exists', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    })

    const fd = makeFormData(baseEventForm)
    await expect(createEvent(fd)).rejects.toThrow('NEXT_REDIRECT:/login')
  })
})

// ── updateEventStatus ──────────────────────────────────────────────────────

describe('updateEventStatus', () => {
  it('returns { success } when status is updated', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        const eqMock = vi.fn().mockResolvedValue({ error: null })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
    })

    const result = await updateEventStatus('event-1', 'live')
    expect(result).toEqual({ success: true })
  })

  it('returns { error } when DB update fails', async () => {
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Update error' } })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
    })

    const result = await updateEventStatus('event-1', 'live')
    expect(result).toEqual({ error: 'Update error' })
  })
})

// ── updateEvent ────────────────────────────────────────────────────────────

describe('updateEvent', () => {
  it('returns { success } on a clean update', async () => {
    // First call: select current event; second call: update
    let callCount = 0
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { banner_url: null }, error: null }),
          }
        }
        const eqMock = vi.fn().mockResolvedValue({ error: null })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
      storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
    })

    const fd = makeFormData({ ...baseEventForm, status: 'published' })
    const result = await updateEvent('event-1', fd)
    expect(result).toEqual({ success: true })
  })

  it('removes old banner from storage when banner_url changes', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null })
    const oldBanner = 'https://test.supabase.co/storage/v1/object/public/banners/old-banner.jpg'
    let callCount = 0

    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { banner_url: oldBanner }, error: null }),
          }
        }
        const eqMock = vi.fn().mockResolvedValue({ error: null })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
      storage: { from: vi.fn(() => ({ remove: removeMock })) },
    })

    // New form has no banner_url — so it changes from old to null
    const fd = makeFormData({ ...baseEventForm, status: 'published' })
    await updateEvent('event-1', fd)
    expect(removeMock).toHaveBeenCalledWith(['old-banner.jpg'])
  })

  it('returns { error } when DB update fails', async () => {
    let callCount = 0
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { banner_url: null }, error: null }),
          }
        }
        const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } })
        return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
    })

    const fd = makeFormData({ ...baseEventForm, status: 'published' })
    const result = await updateEvent('event-1', fd)
    expect(result).toEqual({ error: 'Update failed' })
  })
})

// ── deleteEvent ────────────────────────────────────────────────────────────

describe('deleteEvent', () => {
  it('redirects to /events on success', async () => {
    let callCount = 0
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { banner_url: null }, error: null }),
          }
        }
        const eqMock = vi.fn().mockResolvedValue({ error: null })
        return { delete: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
      storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
    })

    await expect(deleteEvent('event-1')).rejects.toThrow('NEXT_REDIRECT:/events')
  })

  it('returns { error } when DB delete fails', async () => {
    let callCount = 0
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { banner_url: null }, error: null }),
          }
        }
        const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        return { delete: vi.fn().mockReturnValue({ eq: eqMock }) }
      }),
    })

    const result = await deleteEvent('event-1')
    expect(result).toEqual({ error: 'Delete failed' })
  })
})
