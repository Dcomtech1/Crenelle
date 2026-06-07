import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Next.js server mocks ───────────────────────────────────────────────────
// These modules can't run outside of the Next.js runtime, so we stub them.

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((key: string) => {
        if (key === 'x-forwarded-for') return '127.0.0.1'
        if (key === 'x-real-ip') return '127.0.0.1'
        return null
      }),
    })
  ),
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}))

// Stub env vars that Supabase clients expect at module load time
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.SENTRY_DSN = ''
process.env.NEXT_PUBLIC_SENTRY_DSN = ''
