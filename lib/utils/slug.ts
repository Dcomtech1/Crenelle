/**
 * lib/utils/slug.ts
 *
 * URL-safe slug generator used when creating or updating open events.
 * Extracted here so it can be unit-tested independently of the server-action
 * context (which requires Next.js internals to be fully initialised).
 */

/**
 * Generate a URL-safe slug from any event name.
 * - Lowercases the string
 * - Replaces any non-alphanumeric run with a single hyphen
 * - Strips leading/trailing hyphens
 * - Truncates the base to 40 chars
 * - Appends a 4-character random alphanumeric suffix so sibling events with
 *   the same name never collide
 *
 * @example
 * generateSlug('My Summer Gala 2025') // => "my-summer-gala-2025-a3f7"
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}
