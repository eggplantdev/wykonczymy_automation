import { test, expect, type Page } from '@playwright/test'
import { pickComboOption } from './drivers/combo'
import { parsePln, uniqueAmount } from './support/money'
import { readListingFigure } from './support/table'
import { waitForHydration } from './support/wait'
import { CLEAN_INVESTMENT, LOSS_INVESTMENT } from '@/scripts/e2e-dump-rows'
import {
  ensureSettlementMode,
  openPanelView,
  readInvestorBalance,
  readSummaryFigures,
} from './drivers/settlement'

// the type is picked FIRST because switching it re-runs `resetConditionalFields`, which rewrites the investment field.
async function bookLoss(page: Page, investmentName: string, amount: number): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  await trigger.click()

  await page.getByText('Nowy wydatek').first().waitFor()
  await page.getByLabel('Typ wydatku', { exact: true }).click()
  await page.getByRole('option', { name: 'Strata', exact: true }).click()
  await pickComboOption(page, 'Inwestycja', investmentName)
  await page.getByLabel('Kwota').first().fill(amount.toFixed(2))
  await page.locator('[id="lineItems[0].description"]').fill(`E2E strata ${Date.now()}`)

  // `exact`, because „Zapisz jako domyślną kasę" sits in the same dialog on other types.
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await page.getByText('Nowy wydatek').first().waitFor({ state: 'hidden' })
}

async function readSettlement(
  page: Page,
  investmentId: number,
): Promise<{ due: number; loss: number }> {
  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)
  const due = figures['Pozostało do zapłaty']
  expect(due, `no „Pozostało do zapłaty" step on inwestycja ${investmentId}`).toBeTruthy()
  return { due: parsePln(due), loss: parsePln(figures['Strata'] ?? '0') }
}

test('a booked strata raises the investor balance by the same kwota on the listing and on the investment page', async ({
  page,
}) => {
  const amount = uniqueAmount()

  const listingBefore = await readListingFigure(page, LOSS_INVESTMENT.name, 'Bilans netto v1')
  await page.goto(`/inwestycje/${LOSS_INVESTMENT.id}?widok=v1`)
  const headerBefore = await readInvestorBalance(page)
  expect(headerBefore).toBeCloseTo(listingBefore, 2)

  await bookLoss(page, LOSS_INVESTMENT.name, amount)

  await expect
    .poll(() => readListingFigure(page, LOSS_INVESTMENT.name, 'Bilans netto v1'))
    .toBeCloseTo(listingBefore + amount, 2)

  await page.goto(`/inwestycje/${LOSS_INVESTMENT.id}?widok=v1`)
  expect(await readInvestorBalance(page)).toBeCloseTo(headerBefore + amount, 2)

  const tile = page.getByRole('button', { name: /^Strata:/ })
  await waitForHydration(tile)
  const tileAmount = parsePln((await tile.textContent()) ?? '')
  await tile.click()
  await expect
    .poll(() => readInvestorBalance(page))
    .toBeCloseTo(headerBefore + amount - tileAmount, 2)
})

test('a strata deducts at face value on the brutto plane of the v2 settlement', async ({
  page,
}) => {
  const amount = uniqueAmount()
  // Tryb brutto, because brutto is the one plane where a strata and a rabat part ways
  await ensureSettlementMode(page, LOSS_INVESTMENT.id, 'Brutto')

  const before = await readSettlement(page, LOSS_INVESTMENT.id)

  await bookLoss(page, LOSS_INVESTMENT.name, amount)

  await expect
    .poll(async () => (await readSettlement(page, LOSS_INVESTMENT.id)).due)
    .toBeCloseTo(before.due - amount, 2)

  // It renders negative (a subtracted step), hence the widening magnitude.
  const after = await readSettlement(page, LOSS_INVESTMENT.id)
  expect(after.loss).toBeCloseTo(before.loss - amount, 2)
})

test('an investment with no strata prints no strata step', async ({ page }) => {
  await page.goto(`/inwestycje/${CLEAN_INVESTMENT.id}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)

  expect(
    figures['Pozostało do zapłaty'] ?? figures['Pozostało do zapłaty*'],
    'the panel rendered no settlement at all',
  ).toBeTruthy()
  expect(figures['Strata']).toBeUndefined()
})
