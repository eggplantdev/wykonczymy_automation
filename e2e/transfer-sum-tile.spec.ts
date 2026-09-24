import { test, expect, type Page } from '@playwright/test'
import { parsePln } from './support/money'
import { readColumn } from './support/table'
import { createInvestmentExpense, EXPENSE_REGISTER } from './drivers/expenses'
import { openTransferFilters } from './drivers/transfers'

// EX-627 — the „Suma wybranych transakcji" tile against the rows the list actually shows.
//
// The tile is not a client-side sum of the page: it is a SECOND query
// (`sumFilteredByType`, raw SQL) over the same filters, so nothing makes the two agree except the
// two `where` clauses staying in step. They have already drifted apart once — EX-574 overcounted by
// 71 % because a CANCELLATION row copies its original's amount and carries `cancelled = false`, so
// the SQL's hardcoded `cancelled IS NOT TRUE` let it through while the list kept it out. That seam
// is invisible below the browser: one side is a Payload `Where`, the other a SQL string built from
// it by `stripCancelledFilters`, and only a rendered page holds both answers at once.
//
// The issue named `/raporty`, which today renders nothing but „W budowie" (EX-598). The tile itself
// moved: it lives on every transfers table and appears only while a filter is active. The dashboard
// is the surface used here because its `where` is `buildTransferFilters` alone — a register or
// investment page additionally narrows by a field a CANCELLATION row does not carry, which would
// hide the very row the regression turns on.
//
// The two modes assert the same contract from both sides:
//   • default view — the tile EQUALS the sum of the listed „Kwota" cells, and claims so silently.
//   • „pokaż anulowane" — the list widens to rows the sum can never count, and the app says that out
//     loud with the tooltip instead of printing a figure that quietly disagrees.
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
 * Add up the „Kwota" column of every listed row. A cell can carry a second „netto …" line, so only
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
  // Two bookings of the same amount and one cancellation — three rows in the DB, of which the
  // default view shows one. A sum that counted the other two would be the EX-574 regression.
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
  // No tooltip: in this mode the tile claims to agree with the list, so it has to.
  await expect(sumTileTooltip(page)).toHaveCount(0)
  expect(parsePln((await tile.textContent()) ?? '')).toBeCloseTo(await sumListedAmounts(page), 2)

  // The other side of the contract. With cancelled rows shown the list carries rows the sum is
  // built never to count, so the figures legitimately part ways — and the app announces it rather
  // than leaving the owner to notice.
  await page.goto(`/?amount=${encodeURIComponent(AMOUNT_FILTER)}&showCancelled=1`)
  await expect(page.getByRole('cell', { name: cancelled }).first()).toBeVisible()
  await openTransferFilters(page)
  await expect(sumTileTooltip(page)).toBeVisible()
})
