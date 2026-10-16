import { test, expect, type Page } from '@playwright/test'
import { parsePln } from './support/money'
import {
  createInvestmentExpense,
  EXPENSE_CATEGORY,
  openExpenseInvestment,
} from './drivers/expenses'
import { openPanelView, readInvestorBalance, readSummaryFigures } from './drivers/settlement'

test.use({ storageState: 'e2e/.auth/user.json' })

// The delta is asserted exactly, so a round 100 zł could be satisfied by an unrelated concurrent
// booking.
const EXPENSE_AMOUNT = 137.41

async function readCategoryTile(page: Page, investmentId: number): Promise<number> {
  await page.goto(`/inwestycje/${investmentId}?widok=v1`)
  const tile = page.getByRole('button', { name: new RegExp(`^${EXPENSE_CATEGORY}:`) })
  await tile.waitFor()
  return parsePln((await tile.textContent()) ?? '')
}

test('a booked investment expense moves the investment page without a manual refresh', async ({
  page,
}) => {
  const investmentId = await openExpenseInvestment(page)

  const categoryBefore = await readCategoryTile(page, investmentId)
  const balanceBefore = await readInvestorBalance(page)

  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  const materialsBefore = (await readSummaryFigures(page))['Materiały']
  expect(materialsBefore, '„Materiały" is missing from the v2 panel').toBeTruthy()

  const description = `E2E wydatek ${Date.now()}`
  await createInvestmentExpense(page, String(EXPENSE_AMOUNT), description)

  // `expect.poll` allows for the revalidation to land, but not for a manual refresh — nothing here
  // presses „Odśwież dane".
  await expect
    .poll(() => readCategoryTile(page, investmentId), { timeout: 20_000 })
    .toBeCloseTo(categoryBefore + EXPENSE_AMOUNT, 2)
  expect(await readInvestorBalance(page)).toBeCloseTo(balanceBefore - EXPENSE_AMOUNT, 2)

  // The v2 reading prices materiały at what the investor is billed — the investment's own stawka,
  // not the receipt.
  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  await expect
    .poll(async () => (await readSummaryFigures(page))['Materiały'], { timeout: 20_000 })
    .not.toBe(materialsBefore)

  await openPanelView(page, 'Materiały')
  await expect(page.getByText(description).first()).toBeVisible({ timeout: 20_000 })
})
