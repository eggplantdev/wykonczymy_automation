import { test, expect } from '@playwright/test'
import { login, waitForHydration } from './helpers'

// Unauthenticated on purpose: this spec drives the real login itself to prove the whole
// cookie round-trip — payload-token is set on login, honored by requireAuth on the next RSC
// request (the dashboard renders), and cleared by logout (redirect back to /zaloguj).
test('login sets the session, dashboard renders, logout clears it', async ({ page }) => {
  await login(page)

  const logout = page.getByRole('button', { name: 'Wyloguj' })
  await expect(logout).toBeVisible()

  await waitForHydration(logout)
  await logout.click()
  await page.waitForURL('**/zaloguj')
  await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
})
