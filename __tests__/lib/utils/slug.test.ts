import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils/slug'

describe('generateSlug', () => {
  it('lowercases the input', () => {
    const slug = generateSlug('My Summer Gala')
    // strip the trailing -xxxx suffix before checking
    const base = slug.slice(0, slug.lastIndexOf('-'))
    expect(base).toBe('my-summer-gala')
  })

  it('replaces spaces with hyphens', () => {
    const slug = generateSlug('hello world')
    expect(slug).toMatch(/^hello-world-/)
  })

  it('collapses multiple non-alphanumeric chars into a single hyphen', () => {
    const slug = generateSlug('a  --  b')
    expect(slug).toMatch(/^a-b-/)
  })

  it('strips leading hyphens', () => {
    const slug = generateSlug('---my-event')
    expect(slug).not.toMatch(/^-/)
  })

  it('strips trailing hyphens from the base (before the suffix)', () => {
    const slug = generateSlug('event---')
    // base should be "event", suffix is 4 chars, so slug is "event-xxxx"
    expect(slug).toMatch(/^event-[a-z0-9]{4}$/)
  })

  it('truncates base to 40 characters', () => {
    const longName = 'a'.repeat(60)
    const slug = generateSlug(longName)
    // total = 40 base + 1 separator + 4 suffix = 45
    expect(slug.length).toBe(45)
  })

  it('appends a 4-character alphanumeric suffix', () => {
    const slug = generateSlug('test event')
    const suffix = slug.split('-').at(-1)!
    expect(suffix).toMatch(/^[a-z0-9]{4}$/)
  })

  it('produces different slugs on repeated calls for the same name', () => {
    const a = generateSlug('duplicate event')
    const b = generateSlug('duplicate event')
    // Suffixes differ — collision is astronomically unlikely with 36^4 = 1.68M combos
    expect(a).not.toBe(b)
  })

  it('handles special characters like & / @ gracefully', () => {
    const slug = generateSlug('Rock & Roll @ The Arena')
    expect(slug).toMatch(/^rock-roll-the-arena-/)
  })

  it('handles numeric-only names', () => {
    const slug = generateSlug('2025')
    expect(slug).toMatch(/^2025-[a-z0-9]{4}$/)
  })

  it('handles a single word with no spaces', () => {
    const slug = generateSlug('Gala')
    expect(slug).toMatch(/^gala-[a-z0-9]{4}$/)
  })
})
