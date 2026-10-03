import { test, expect } from '@playwright/test'
import { waitForHydration } from './support/wait'

test.use({ storageState: 'e2e/.auth/user.json' })

// EX-909. A browser Back restores the router's cached `/szablony`, so the create has to refresh that
// entry itself; a reload would refetch and hide a stale list, so there is none.
test('„Nowy szablon" → Wstecz: lista pokazuje nowy szablon bez przeładowania', async ({ page }) => {
  const name = `E2E Nowy szablon ${Date.now()}`

  await page.goto('/szablony')
  const create = page.getByRole('button', { name: 'Nowy szablon' })
  await waitForHydration(create)
  await create.click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Nowy szablon' })
  await dialog.getByLabel('Nazwa szablonu').fill(name)
  await dialog.getByRole('button', { name: 'Załóż', exact: true }).click()

  await page.waitForURL(/\/szablony\/\d+/)
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 20_000 })

  await page.goBack()
  await page.waitForURL(/\/szablony$/)
  await expect(page.getByText(name, { exact: true })).toBeVisible()
})
