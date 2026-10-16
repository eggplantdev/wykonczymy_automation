import { test, expect } from '@playwright/test'
import { login } from './support/auth'
import { waitForHydration } from './support/wait'

test('login sets the session, dashboard renders, logout clears it', async ({ page }) => {
  await login(page)

  const logout = page.getByRole('button', { name: 'Wyloguj' })
  await expect(logout).toBeVisible()

  await waitForHydration(logout)
  await logout.click()
  await page.waitForURL('**/zaloguj')
  await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
})
