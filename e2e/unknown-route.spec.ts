import { test, expect } from '@playwright/test'
import { expectNotFound } from './support/not-found'
import { waitForHydration } from './support/wait'

test('a nav link on the page of an unknown URL leaves the 404', async ({ page }) => {
  await page.goto('/szablony-kosztorysow')
  await expectNotFound(page)

  const link = page.getByRole('link', { name: 'Szablony kosztorysów' }).first()
  await waitForHydration(link)
  await link.click()

  await page.waitForURL('**/szablony')
  await expect(page.getByRole('button', { name: 'Nowy szablon' })).toBeVisible()
  await expect(page.getByText('Application error')).toHaveCount(0)
  await expect(page.getByText('Nie znaleziono')).toHaveCount(0)
})
