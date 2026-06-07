import { describe, it, expect } from 'vitest'
import { validateEmailBlob, validateCsvRows, GuestRowSchema } from '@/lib/validations/guest-import'

// ── validateEmailBlob ───────────────────────────────────────────────────────

describe('validateEmailBlob', () => {
  it('accepts a single valid email', () => {
    const { valid, invalid } = validateEmailBlob('alice@example.com')
    expect(valid).toEqual(['alice@example.com'])
    expect(invalid).toHaveLength(0)
  })

  it('lowercases and trims each email', () => {
    const { valid } = validateEmailBlob('  ALICE@Example.COM  ')
    expect(valid).toEqual(['alice@example.com'])
  })

  it('splits on newlines', () => {
    const { valid } = validateEmailBlob('a@x.com\nb@x.com\nc@x.com')
    expect(valid).toHaveLength(3)
  })

  it('splits on commas', () => {
    const { valid } = validateEmailBlob('a@x.com,b@x.com,c@x.com')
    expect(valid).toHaveLength(3)
  })

  it('splits on semicolons', () => {
    const { valid } = validateEmailBlob('a@x.com;b@x.com')
    expect(valid).toHaveLength(2)
  })

  it('splits on whitespace', () => {
    const { valid } = validateEmailBlob('a@x.com   b@x.com')
    expect(valid).toHaveLength(2)
  })

  it('deduplicates identical emails', () => {
    const { valid } = validateEmailBlob('a@x.com\na@x.com\nA@X.COM')
    expect(valid).toEqual(['a@x.com'])
  })

  it('collects invalid entries separately', () => {
    const { valid, invalid } = validateEmailBlob('good@example.com\nnot-an-email\nbad@')
    expect(valid).toEqual(['good@example.com'])
    expect(invalid).toContain('not-an-email')
    expect(invalid).toContain('bad@')
  })

  it('handles empty input gracefully', () => {
    const { valid, invalid } = validateEmailBlob('')
    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })

  it('handles whitespace-only input gracefully', () => {
    const { valid, invalid } = validateEmailBlob('   \n\n  ')
    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })

  it('rejects an email exceeding 254 characters', () => {
    // 249 local chars + @x.com (6) = 255 total — over the 254 limit
    const longLocal = 'a'.repeat(249)
    const longEmail = `${longLocal}@x.com`
    expect(longEmail.length).toBeGreaterThan(254)
    const { invalid } = validateEmailBlob(longEmail)
    expect(invalid).toContain(longEmail)
  })
})

// ── GuestRowSchema ──────────────────────────────────────────────────────────

describe('GuestRowSchema', () => {
  const validRow = {
    name: 'Alice Wonderland',
    email: 'alice@example.com',
    phone: null,
    party_size: 2,
    seat_info: null,
  }

  it('parses a valid row', () => {
    const result = GuestRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
  })

  it('lowercases and trims each email — only when pre-trimmed (Zod v4 validates before transform)', () => {
    // Zod v4 .email() validates the raw string before running .transform()
    // So whitespace-padded input fails validation. Pass a clean uppercase email.
    const result = GuestRowSchema.safeParse({ ...validRow, email: 'ALICE@EXAMPLE.COM' })
    if (!result.success) throw new Error('Expected success: ' + JSON.stringify(result.error.issues))
    expect(result.data.email).toBe('alice@example.com')
  })

  it('trims the name', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, name: '  Alice  ' })
    expect(result.success && result.data.name).toBe('Alice')
  })

  it('rejects a name shorter than 2 characters', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects a name longer than 120 characters', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, name: 'A'.repeat(121) })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email address', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects party_size of 0', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, party_size: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects party_size over 50', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, party_size: 51 })
    expect(result.success).toBe(false)
  })

  it('defaults party_size to 1 when not provided', () => {
    const result = GuestRowSchema.safeParse({ name: 'Bob', email: 'bob@x.com' })
    expect(result.success && result.data.party_size).toBe(1)
  })

  it('allows null phone', () => {
    const result = GuestRowSchema.safeParse({ ...validRow, phone: null })
    expect(result.success && result.data.phone).toBeNull()
  })
})

// ── validateCsvRows ─────────────────────────────────────────────────────────

describe('validateCsvRows', () => {
  it('parses standard headers correctly', () => {
    const rows = [{ name: 'Alice', email: 'alice@x.com', party_size: '2' }]
    const { valid, errors } = validateCsvRows(rows)
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(0)
    expect(valid[0].email).toBe('alice@x.com')
    expect(valid[0].party_size).toBe(2)
  })

  it('normalises "full name" and "email address" header aliases', () => {
    const rows = [{ 'full name': 'Bob', 'email address': 'bob@x.com' }]
    const { valid } = validateCsvRows(rows)
    expect(valid).toHaveLength(1)
    expect(valid[0].name).toBe('Bob')
  })

  it('trims and lowercases header keys', () => {
    const rows = [{ '  Name  ': 'Carol', '  Email  ': 'carol@x.com' }]
    const { valid } = validateCsvRows(rows)
    expect(valid).toHaveLength(1)
  })

  it('collects row-level errors for invalid rows', () => {
    const rows = [
      { name: 'Valid', email: 'valid@x.com' },
      { name: 'X', email: 'not-an-email' }, // name too short + bad email
    ]
    const { valid, errors } = validateCsvRows(rows)
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(3) // header is row 1, first data row is row 2
  })

  it('returns empty arrays for empty input', () => {
    const { valid, errors } = validateCsvRows([])
    expect(valid).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('defaults party_size to 1 when column is missing', () => {
    const rows = [{ name: 'Dave', email: 'dave@x.com' }]
    const { valid } = validateCsvRows(rows)
    expect(valid[0].party_size).toBe(1)
  })

  it('parses the "seat" alias for seat_info', () => {
    const rows = [{ name: 'Eve', email: 'eve@x.com', seat: 'Table 5' }]
    const { valid } = validateCsvRows(rows)
    expect(valid[0].seat_info).toBe('Table 5')
  })
})
