import { test, expect } from '@playwright/test'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { discountModeSelect, openSettlementOptions, pickDiscountMode } from './drivers/settlement'

// EX-597 regression guard. A failed rabat save has to leave the panel describing the deal the data
// still holds: the mode select back on „Kwotowy", the block usable again, and one toast saying why.
// The bug this replaces silently broke all three at once — the optimistic value never committed, so
// its rollback was invisible, and the transition that owned both never completed, leaving „Opcje
// rozliczenia" permanently disabled. Only the browser sees that: the action returns the same failure
// either way, and the DB (correctly) never moved.
test.use({ storageState: 'e2e/.auth/user.json' })

let investment: number

test.beforeAll(async ({ browser }) => {
  investment = runSeedScript<{ investment: number }>(
    'seed:kosztorys-bands',
    'BANDS_SEED',
  ).investment
  await refreshReferenceData(browser)
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
