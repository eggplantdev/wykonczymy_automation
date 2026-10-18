import { test, expect } from '@playwright/test'
import { readSeed } from './support/seeds'
import { discountModeSelect, openSettlementOptions, pickDiscountMode } from './drivers/settlement'

let investment: number

test.beforeAll(() => {
  investment = readSeed('discountFailedSave').investment
})

test('a failed rabat save restores the mode and leaves the block usable', async ({ page }) => {
  await page.goto(`/inwestycje/${investment}/kosztorys_v2`)
  await openSettlementOptions(page)

  await pickDiscountMode(page, 'Kwotowy')
  await expect(discountModeSelect(page)).toHaveText('Kwotowy')

  // Kill the write at the driver, not in page JS: a fetch monkeypatch installed from the page wedges
  // this app's main thread, which then reads as the very defect under test.
  await page.route('**/*', async (route) => {
    if (route.request().headers()['next-action']) return route.abort('failed')
    return route.continue()
  })
  await pickDiscountMode(page, 'Wyłączony')

  await expect(page.locator('.Toastify__toast')).toHaveText('Nie udało się zapisać rabatu', {
    timeout: 90_000,
  })
  await expect(discountModeSelect(page)).toHaveText('Kwotowy', { timeout: 90_000 })
  await expect(discountModeSelect(page)).toBeEnabled()

  // Still usable after the failure — the stuck-transition bug only showed up on the NEXT interaction.
  await page.unroute('**/*')
  await pickDiscountMode(page, 'Wyłączony')
  await expect(discountModeSelect(page)).toHaveText('Wyłączony', { timeout: 90_000 })
})
