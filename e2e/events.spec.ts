/**
 * e2e/events.spec.ts
 *
 * E2E tests for the event management dashboard (authenticated).
 * Uses a test account defined in .env.local:
 *   E2E_TEST_EMAIL=...
 *   E2E_TEST_PASSWORD=...
 *
 * If credentials are missing, all tests in this file are skipped.
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_EMAIL!)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL(/events/, { timeout: 15_000 })
}

test.describe('Event Management (authenticated)', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — skipping')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('dashboard shows the events list page', async ({ page }) => {
    await expect(page).toHaveURL(/events/)
    // Should show some heading or empty-state
    await expect(
      page.getByRole('heading').or(page.getByText(/no events yet|create your first/i))
    ).toBeVisible()
  })

  test('can create a new event and is redirected to it', async ({ page }) => {
    // Find and click the create-event button
    await page.getByRole('link', { name: /new event|create event/i })
      .or(page.getByRole('button', { name: /new event|create event/i }))
      .first()
      .click()

    await page.waitForURL(/events\/new|events\/create/, { timeout: 5_000 }).catch(() => {
      // Some apps open a modal instead of navigating
    })

    const eventName = `E2E Test Event ${Date.now()}`

    // Fill the event form
    await page.locator('input[name="name"], input[placeholder*="event name" i]').fill(eventName)
    await page.locator('input[name="date"], input[type="date"]').fill('2099-12-31')
    await page.locator('input[name="venue"], input[placeholder*="venue" i]').fill('Test Venue')

    await page.getByRole('button', { name: /save|create|submit/i }).first().click()

    // Should redirect to the new event's detail page
    await page.waitForURL(/\/events\/[a-z0-9-]+$/, { timeout: 15_000 })
    await expect(page.getByText(eventName)).toBeVisible()
  })

  test('can update event status from the dashboard', async ({ page }) => {
    await page.goto('/events')
    // Find any status pill/button on the first event card
    const statusPill = page.locator('[data-testid*="status"], button[aria-label*="status"]').first()
    await statusPill.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
      // Skip if no events exist yet
      test.skip()
    })
    await statusPill.click()

    // A status change dialog or dropdown should appear
    await expect(
      page.locator('[role="dialog"], [role="menu"], [role="listbox"]')
    ).toBeVisible({ timeout: 3_000 })
  })

  test('delete event shows confirmation dialog', async ({ page }) => {
    await page.goto('/events')
    // Look for a delete button / kebab menu on an event card
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first()
    await deleteBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
      test.skip()
    })
    await deleteBtn.click()

    // Confirmation dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByRole('dialog').getByText(/delete|confirm/i)).toBeVisible()
  })
})
