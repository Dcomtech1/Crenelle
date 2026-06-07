import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema } from '@/lib/validations/auth'

// ── signupSchema ────────────────────────────────────────────────────────────

describe('signupSchema', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'SecurePass1!',
    confirm: 'SecurePass1!',
  }

  it('accepts a fully valid signup payload', () => {
    expect(signupSchema.safeParse(validInput).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = signupSchema.safeParse({ ...validInput, email: 'not-an-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('email')
    }
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({ ...validInput, password: 'Ab1!', confirm: 'Ab1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('PASSWORD_MIN_8_CHARACTERS')
    }
  })

  it('rejects a password without an uppercase letter', () => {
    const result = signupSchema.safeParse({ ...validInput, password: 'nouppercase1!', confirm: 'nouppercase1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'PASSWORD_NEED_UPPERCASE')).toBe(true)
    }
  })

  it('rejects a password without a lowercase letter', () => {
    const result = signupSchema.safeParse({ ...validInput, password: 'NOLOWER1!', confirm: 'NOLOWER1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'PASSWORD_NEED_LOWERCASE')).toBe(true)
    }
  })

  it('rejects a password without a digit', () => {
    const result = signupSchema.safeParse({ ...validInput, password: 'NoDigits!', confirm: 'NoDigits!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'PASSWORD_NEED_NUMBER')).toBe(true)
    }
  })

  it('rejects a password without a special character', () => {
    const result = signupSchema.safeParse({ ...validInput, password: 'NoSpecial1', confirm: 'NoSpecial1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'PASSWORD_NEED_SPECIAL_CHARACTER')).toBe(true)
    }
  })

  it('rejects mismatching password and confirm', () => {
    const result = signupSchema.safeParse({ ...validInput, confirm: 'DifferentPass1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'PASSWORDS_DO_NOT_MATCH')).toBe(true)
    }
  })

  it('fails on multiple violations simultaneously', () => {
    const result = signupSchema.safeParse({ email: 'bad', password: 'weak', confirm: 'diff' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(1)
    }
  })
})

// ── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  const validLogin = { email: 'user@example.com', password: 'anypassword' }

  it('accepts valid login credentials', () => {
    expect(loginSchema.safeParse(validLogin).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ ...validLogin, email: 'bad-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('INVALID_EMAIL_ADDRESS')
    }
  })

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ ...validLogin, password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('PASSWORD_REQUIRED')
    }
  })

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'somepassword' })
    expect(result.success).toBe(false)
  })

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(false)
  })
})
