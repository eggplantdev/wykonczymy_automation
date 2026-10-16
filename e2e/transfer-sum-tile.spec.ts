import { test, expect, type Page } from '@playwright/test'
import { parsePln } from './support/money'
import { readColumn } from './support/table'
import { createInvestmentExpense, EXPENSE_REGISTER } from './drivers/expenses'
import { openTransferFilters } from './drivers/transfers'

// The dashboard
// is the surface used here because its `where` is `buildTransferFilters` alone — a register or
// investment page additionally narrows by a field a CANCELLATION row does not carry, which would
// hide the very row the regression turns on.
test.use({ storageState: 'e2e/.auth/user.json' })

// Two decimal places, so `normalizeAmountSearch` degrades the range to an exact match and the
// filtered set is this test's own rows plus, at worst, a dump row of the same value — which the
// assertions tolerate by comparing the tile against whatever is listed, never against a literal.
const AMOUNT = '6784.93'
const AMOUNT_FILTER = '6784,93'

const sumTile = (page: Page) =>
  page.locator('button').filter({ hasText: 'Suma wybranych transakcji' }).first()

const sumTileTooltip = (page: Page) =>
  page.getByRole('button', { name: 'Co to jest: Suma wybranych transakcji' })

/**
 * A cell can carry a second „netto …" line, so only
 * the first money figure — the brutto one the tile sums — is taken.
 */
async function sumListedAmounts(page: Page): Promise<number> {
  const cells = await readColumn(page, 'Kwota')
  return cells.reduce((total, text) => {
    const [amount] = text.match(/-?[\d\s]+,\d{2}/) ?? []
    if (!amount) throw new Error(`unreadable „Kwota" cell: ${text}`)
    return total + parsePln(amount)
  }, 0)
}

test('kafelek „Suma wybranych transakcji" równa się sumie wierszy, które lista pokazuje', async ({
  page,
}) => {
  const live = `E2E-suma-zywy-${Date.now()}`
  const cancelled = `E2E-suma-anulowany-${Date.now()}`

  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await createInvestmentExpense(page, AMOUNT, live)
  await createInvestmentExpense(page, AMOUNT, cancelled)

  const row = page.getByRole('row').filter({ hasText: cancelled })
  await row.getByRole('button', { name: 'Anuluj transakcję' }).first().click()
  await page.getByLabel('Powód anulowania (wymagany)').fill('EX-627 — kafelek vs. wiersze')
  await page.getByRole('button', { name: 'Tak, anuluj' }).click()
  await expect(page.getByText('Anulowanie transakcji')).toBeHidden()

  await page.goto(`/?amount=${encodeURIComponent(AMOUNT_FILTER)}`)
  await expect(page.getByRole('cell', { name: live }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: cancelled })).toHaveCount(0)

  await openTransferFilters(page)
  const tile = sumTile(page)
  await expect(tile).toBeVisible()
  await expect(sumTileTooltip(page)).toHaveCount(0)
  expect(parsePln((await tile.textContent()) ?? '')).toBeCloseTo(await sumListedAmounts(page), 2)

  await page.goto(`/?amount=${encodeURIComponent(AMOUNT_FILTER)}&showCancelled=1`)
  await expect(page.getByRole('cell', { name: cancelled }).first()).toBeVisible()
  await openTransferFilters(page)
  await expect(sumTileTooltip(page)).toBeVisible()
})
