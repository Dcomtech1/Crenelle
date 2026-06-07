/**
 * e2e/public-registration.spec.ts
 *
 * E2E tests for the public event registration page (/register/[slug]).
 * These run against the live local Supabase instance.
 *
 * NOTE: These tests require at least one published open event with a known slug
 * in your local Supabase DB. Set E2E_TEST_EVENT_SLUG in .env.local (or .env.test)
 * to point to it. If the var is not set, tests are skipped gracefully.
 */
import { test, expect } from '@playwright/test'

const TEST_SLUG = process.env.E2E_TEST_EVENT_SLUG

test.describe('Public Registration', () => {
  test.skip(!TEST_SLUG, 'E2E_TEST_EVENT_SLUG not set — skipping public registration tests')

  const slug = TEST_SLUG ?? 'placeholder'
  const baseUrl = `/register/${slug}`

  test('registration page renders the event details', async ({ page }) => {
    await page.goto(baseUrl)
    // Should show the event name (h1) and a form
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
  })

  test('shows name and email fields', async ({ page }) => {
    await page.goto(baseUrl)
    await expect(page.locator('input[name="full_name"], input[placeholder*="name" i]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('successful registration shows a confirmation message', async ({ page }) => {
    await page.goto(baseUrl)

    const uniqueEmail = `e2e-reg-${Date.now()}@mailtest.dev`

    await page.locator('input[name="full_name"], input[placeholder*="name" i]').fill('E2E Test Guest')
    await page.locator('input[type="email"]').fill(uniqueEmail)

    await page.getByRole('button', { name: /register|submit/i }).click()

    // Should show success state — could be a redirect or an inline success message
    await expect(
      page.locator('[data-testid="registration-success"], [role="status"]').or(
        page.getByText(/registered|success|thank you/i)
      )
    ).toBeVisible({ timeout: 10_000 })
  })

  test('duplicate registration returns a user-friendly error', async ({ page }) => {
    const dupeEmail = `e2e-dupe-${Date.now()}@mailtest.dev`
    await page.goto(baseUrl)

    // First registration
    await page.locator('input[name="full_name"], input[placeholder*="name" i]').fill('Dupe Guest')
    await page.locator('input[type="email"]').fill(dupeEmail)
    await page.getByRole('button', { name: /register|submit/i }).click()
    await page.waitForTimeout(1000)

    // Second registration — same email
    await page.goto(baseUrl)
    await page.locator('input[name="full_name"], input[placeholder*="name" i]').fill('Dupe Guest 2')
    await page.locator('input[type="email"]').fill(dupeEmail)
    await page.getByRole('button', { name: /register|submit/i }).click()

    // Should see duplicate error or silent success (per unsubscribe logic)
    // The app returns { error } for duplicates — check the UI surfaces it
    await expect(
      page.getByText(/already registered|duplicate/i).or(page.getByRole('alert'))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('non-existent slug shows a 404 or not-found page', async ({ page }) => {
    const response = await page.goto('/register/this-slug-does-not-exist-xyz')
    // Either 404 status or a not-found message in the UI
    const is404 = response?.status() === 404
    const hasNotFoundText = await page.getByText(/not found|does not exist/i).isVisible()
    expect(is404 || hasNotFoundText).toBe(true)
  })
})
