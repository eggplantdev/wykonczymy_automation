import { test, expect } from '@playwright/test'
import { translate } from '@/lib/i18n/translations'

// A `loading.tsx` at the app root sits ABOVE every root layout (there is no `app/layout.tsx`), so its
// Suspense boundary caught the `notFound()` of a revoked share token: the response went out as 200
// with no `<html>`, and the page died on „Missing <html> and <body> tags in the root layout".
// Only a real request through Next's renderer sees it — the not-found component itself was fine.
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
