import { test, expect, type Page } from '@playwright/test'
import {
  createInvestmentExpense,
  EXPENSE_CATEGORY,
  openExpenseInvestment,
  openPanelView,
  parsePln,
  readInvestorBalance,
  readSummaryFigures,
} from './helpers'

// EX-731 — the last uncovered leg of S-17: a booked transfer has to move the investment's own
// figures. Everything below the browser is already guarded (`pnpm test:parity` recomputes the SQL,
// unit tests recompute marża), so the only thing left that can break is the crossing itself: the
// write invalidates one set of cache tags and the page reads another. A figure served off a stale
// tag looks like a number, not like an error, and nobody catches it in review.
//
// So the rule this spec lives by: never press „Odśwież dane" between the write and the read. That
// button revalidates the layout by hand, and a spec that presses it proves only that the app CAN be
// forced into correctness — same discipline as `investments-listing-kosztorys.spec.ts`.
test.use({ storageState: 'e2e/.auth/user.json' })

// A distinctive amount: the delta is asserted exactly, so a round 100 zł could be satisfied by an
// unrelated concurrent booking. Grosze make the figure this spec's own.
const EXPENSE_AMOUNT = 137.41

// The v1 reading renders one tile per expense category; the tile is a button whose accessible name
// is „<kategoria>: <kwota>".
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

  // Booked through the global „Wydatek" dialog — the same route a user takes, so the write goes
  // through the real server action and its revalidation, not through a seed script that bypasses it.
  const description = `E2E wydatek ${Date.now()}`
  await createInvestmentExpense(page, String(EXPENSE_AMOUNT), description)

  // Straight to the reading. `expect.poll` allows for the revalidation to land, but not for a
  // manual refresh — nothing here presses „Odśwież dane".
  await expect
    .poll(() => readCategoryTile(page, investmentId), { timeout: 20_000 })
    .toBeCloseTo(categoryBefore + EXPENSE_AMOUNT, 2)
  // The expense is a cost, so the investor's balance falls by exactly what the category tile gained.
  expect(await readInvestorBalance(page)).toBeCloseTo(balanceBefore - EXPENSE_AMOUNT, 2)

  // The v2 reading is the default one, and it prices materiały at what the investor is billed — the
  // investment's own stawka, not the receipt. So assert it MOVED rather than by how much; the exact
  // arithmetic is the unit tests' job, the crossing is this spec's.
  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  await expect
    .poll(async () => (await readSummaryFigures(page))['Materiały'], { timeout: 20_000 })
    .not.toBe(materialsBefore)

  // And the booking itself is on the panel's „Materiały" tab, by the description we typed — proof
  // the moved figure moved because of THIS expense rather than a neighbouring test's.
  await openPanelView(page, 'Materiały')
  await expect(page.getByText(description).first()).toBeVisible({ timeout: 20_000 })
})
