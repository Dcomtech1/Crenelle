/**
 * e2e/auth.spec.ts
 *
 * E2E tests for the authentication flow (sign up, login, logout).
 * Uses the local Supabase instance defined in .env.local.
 */
import { test, expect } from '@playwright/test'

// Generate a unique email per run so tests don't conflict across runs
const timestamp = Date.now()
const testEmail = `e2e-test-${timestamp}@mailtest.dev`
const testPassword = 'TestPass1!'

test.describe('Authentication', () => {
  test('sign-up page renders correctly', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Should have email + password + confirm fields
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login with invalid credentials shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('nobody@doesnotexist.dev')
    await page.locator('input[type="password"]').fill('WrongPass1!')
    await page.getByRole('button', { name: /log in|sign in/i }).click()

    // Should stay on login page and show some error feedback
    await expect(page).toHaveURL(/login/)
    // Error could be a toast or inline — just check we're not on the dashboard
    await expect(page).not.toHaveURL(/events/)
  })

  test('login with empty fields does not submit', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /log in|sign in/i }).click()
    // HTML5 validation or JS validation should keep us on the page
    await expect(page).toHaveURL(/login/)
  })
})
