import { test, expect, type Page } from '@playwright/test'
import { login } from './support/auth'
import { waitForHydration } from './support/wait'
import { PHONE_VIEWPORT } from './support/viewport'

// Logout revokes only this session's `sid`, so a fresh login keeps the shared `.auth` sessions alive.
test.use({ storageState: { cookies: [], origins: [] }, viewport: PHONE_VIEWPORT })

const rootOverflow = (page: Page) => page.evaluate(() => document.documentElement.style.overflow)

test('na telefonie menu blokuje przewijanie, a „Wyloguj" na jego dole wylogowuje', async ({
  page,
}) => {
  await login(page)

  const menu = page.getByRole('button', { name: 'Menu' })
  await waitForHydration(menu)
  await menu.click()
  const drawer = page.locator('#mobile-nav')
  await expect(drawer).toBeVisible()
  await expect.poll(() => rootOverflow(page)).toBe('hidden')

  // A click lands only when nothing paints over the drawer's bottom band.
  await drawer.getByRole('button', { name: 'Wyloguj' }).click()
  await page.waitForURL('**/zaloguj')
  await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
})
