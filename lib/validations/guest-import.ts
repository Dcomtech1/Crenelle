/**
 * lib/validations/guest-import.ts
 *
 * Zod schemas for validating guest import rows.
 * Used by both the bulk email import and future CSV import.
 */
import { z } from 'zod'

// ── Single guest row ─────────────────────────────────────────────

export const GuestRowSchema = z.object({
  /** Required — minimum 2 chars to avoid single-letter "names" */
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name is too long (max 120 characters)')
    .transform((v) => v.trim()),

  /** Required */
  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email is too long')
    .transform((v) => v.trim().toLowerCase()),

  /** Optional */
  phone: z
    .string()
    .max(30, 'Phone number is too long')
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),

  /** 1–50 — generous cap; individual edits can refine */
  party_size: z
    .number()
    .int('Party size must be a whole number')
    .min(1, 'Party size must be at least 1')
    .max(50, 'Party size cannot exceed 50')
    .default(1),

  /** Optional seating information */
  seat_info: z
    .string()
    .max(80, 'Seat info is too long (max 80 characters)')
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
})

export type GuestRow = z.infer<typeof GuestRowSchema>

// ── Bulk email-only import ────────────────────────────────────────
// When importing email addresses only (no CSV), we derive name from prefix.

export const BulkEmailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email is too long')
  .transform((v) => v.trim().toLowerCase())

// ── CSV row parser ────────────────────────────────────────────────
// Expects headers: name, email, phone (optional), party_size (optional), seat_info (optional)
// Returns validated rows and a list of row-level errors.

export interface CsvImportResult {
  valid: GuestRow[]
  errors: Array<{ row: number; raw: string; message: string }>
}

/**
 * Parse and validate an array of raw CSV row objects.
 * Each row is a `Record<string, string>` (from a CSV parser).
 */
export function validateCsvRows(
  rows: Record<string, string>[],
): CsvImportResult {
  const valid: GuestRow[] = []
  const errors: CsvImportResult['errors'] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]

    // Normalise header names: trim whitespace, lowercase
    const normalised = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), v]),
    )

    const result = GuestRowSchema.safeParse({
      name: normalised['name'] ?? normalised['full name'] ?? normalised['full_name'] ?? '',
      email: normalised['email'] ?? normalised['email address'] ?? '',
      phone: normalised['phone'] ?? normalised['phone number'] ?? null,
      party_size: normalised['party_size']
        ? Number(normalised['party_size'])
        : normalised['party size']
          ? Number(normalised['party size'])
          : 1,
      seat_info: normalised['seat_info'] ?? normalised['seat'] ?? normalised['table'] ?? null,
    })

    if (result.success) {
      valid.push(result.data)
    } else {
      errors.push({
        row: i + 2, // +2 because row 1 is header, and humans count from 1
        raw: Object.values(raw).join(', '),
        message: result.error.errors.map((e) => e.message).join('; '),
      })
    }
  }

  return { valid, errors }
}

/**
 * Parse a raw email-only text blob (newline/comma/semicolon separated).
 * Returns deduplicated, validated emails and invalid entries.
 */
export function validateEmailBlob(text: string): {
  valid: string[]
  invalid: string[]
} {
  const raw = text.split(/[\n,;\s]+/)
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []

  for (const entry of raw) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    const result = BulkEmailSchema.safeParse(trimmed)
    if (result.success && !seen.has(result.data)) {
      seen.add(result.data)
      valid.push(result.data)
    } else if (!result.success) {
      invalid.push(trimmed)
    }
    // duplicate: silently skip (already in seen)
  }

  return { valid, invalid }
}
