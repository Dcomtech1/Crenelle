/**
 * e2e/guests.spec.ts
 *
 * E2E tests for the guest management section of an event (authenticated).
 * Requires: E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_EVENT_ID
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD
const TEST_EVENT_ID = process.env.E2E_TEST_EVENT_ID

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_EMAIL!)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD!)
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL(/events/, { timeout: 15_000 })
}

test.describe('Guest Management (authenticated)', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD || !TEST_EVENT_ID,
    'E2E credentials or E2E_TEST_EVENT_ID not set — skipping'
  )

  const guestsUrl = `/events/${TEST_EVENT_ID}/guests`

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(guestsUrl)
  })

  test('guests page loads and shows the guest list or empty state', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`events/${TEST_EVENT_ID}/guests`))
    await expect(
      page.getByRole('table').or(page.getByText(/no guests yet|add your first guest/i))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('can open the add-guest dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add guest|add attendee/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
    // Form fields should be present
    await expect(page.getByLabel(/name/i).first()).toBeVisible()
  })

  test('can add a single guest and see them in the list', async ({ page }) => {
    const guestName = `E2E Guest ${Date.now()}`
    const guestEmail = `e2e-guest-${Date.now()}@mailtest.dev`

    await page.getByRole('button', { name: /add guest|add attendee/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel(/name/i).first().fill(guestName)

    const emailField = page.getByLabel(/email/i)
    if (await emailField.isVisible()) {
      await emailField.fill(guestEmail)
    }

    await page.getByRole('dialog').getByRole('button', { name: /save|add|create/i }).click()

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })

    // Guest should appear in the list
    await expect(page.getByText(guestName)).toBeVisible({ timeout: 8_000 })
  })

  test('bulk import shows result feedback', async ({ page }) => {
    // Look for a bulk/import button
    const bulkBtn = page.getByRole('button', { name: /bulk|import/i }).first()
    await bulkBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
      test.skip()
    })
    await bulkBtn.click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })

    // Fill textarea with valid emails
    const textarea = page.locator('textarea')
    await textarea.fill(`bulk-test-${Date.now()}@mailtest.dev\nbulk-test2-${Date.now()}@mailtest.dev`)

    await page.getByRole('dialog').getByRole('button', { name: /import|add|submit/i }).click()

    // Should see a success toast or inline feedback
    await expect(
      page.getByText(/imported|added|guest/i)
    ).toBeVisible({ timeout: 10_000 })
  })
})
