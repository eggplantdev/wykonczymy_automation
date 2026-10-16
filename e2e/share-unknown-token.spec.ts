import { test, expect } from '@playwright/test'
import { translate } from '@/lib/i18n/translations'

test('a revoked report link answers 404 and tells the worker the link is dead', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ storageState: undefined, baseURL })
  const page = await context.newPage()

  const response = await page.goto('/z/-/Nikt/revoked-token-that-was-never-issued')

  expect(response?.status()).toBe(404)
  await expect(page.getByText(translate('pl', 'notices', 'unknownToken'))).toBeVisible()
  await context.close()
})
