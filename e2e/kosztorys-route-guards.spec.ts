import { test, expect, type Locator } from '@playwright/test'
import { openExpenseInvestment, openPanelView, readSummaryFigures } from './helpers'

// EX-728 — two regressions caught in the EX-720 review, both fixed, neither guarded. Both are facts
// about what a page RENDERS and what status it answers with, so no layer below the browser sees
// them. Two page loads, zero mutations: the cheapest E2E in the suite.
//
// 1. A missing investment id must resolve to the 404 PAGE before the fan-out. `getKosztorysTree`
//    throws for a missing investment, so an existence check placed after `Promise.all` never runs
//    and the route rendered the error boundary. What it cannot assert is the status code: the
//    segment ships `(frontend)/loading.tsx`, so the shell is flushed at 200 before the page body
//    runs and `notFound()` has no headers left to change. „Nie znaleziono" vs „Coś poszło nie tak"
//    is the whole distinction the regression was about, and it is the distinction asserted.
// 2. The investment page's „Materiały" tab must show the split. That host supplies no transaction
//    rows at all (the prop defaults to `[]`), so a row-sourced gate hid the table and printed „Brak
//    wydatków inwestycyjnych na materiały." over an investment with real spend.
test.use({ storageState: 'e2e/.auth/user.json' })

// High enough that no dump will ever reach it, so the 404 is about the guard and not about a row
// that happened to be deleted.
const MISSING_INVESTMENT_ID = 99_999_999

// Slice a SummaryTable (the app's only inline `grid-template-columns`) back into header → row cells.
// Its cells are direct children of the one grid container — a row wrapper would break the shared
// gridlines — so the track count is what rebuilds the rows.
async function readGridRow(grid: Locator, label: string): Promise<Record<string, string>> {
  const row = await grid.evaluate((node, rowLabel) => {
    const element = node as HTMLElement
    // Computed, not the inline value — `readSummaryFigures` in `helpers.ts` documents why.
    const columns = getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    const cells = Array.from(element.children).map((cell) =>
      (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )
    const headers = cells.slice(0, columns)
    for (let index = columns; index + columns <= cells.length; index += columns) {
      if (cells[index] !== rowLabel) continue
      return Object.fromEntries(
        headers.slice(1).map((header, offset) => [header, cells[index + 1 + offset]]),
      )
    }
    return null
  }, label)
  if (!row) throw new Error(`no „${label}" row in this summary grid`)
  return row
}

test('a missing investment renders the 404 page, not the error boundary', async ({ page }) => {
  await page.goto(`/inwestycje/${MISSING_INVESTMENT_ID}/kosztorys_v2`)

  // Bounded well above the project's 20 s: the 404 itself is served in milliseconds (curl proves it),
  // what takes the time is the app shell hydrating around it on a machine already running the suite.
  await expect(page.getByText('Nie znaleziono')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Coś poszło nie tak')).toHaveCount(0)
})

test('the investment page renders the materiały split for an investment that has one', async ({
  page,
}) => {
  const investmentId = await openExpenseInvestment(page)

  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  const materials = (await readSummaryFigures(page))['Materiały']
  expect(
    materials,
    '„Materiały" is missing from the Podsumowanie — pick another fixture',
  ).toBeTruthy()

  await openPanelView(page, 'Materiały')
  // Scoped by caption: the company-plane („wliczone w robociznę") split is a second grid with its
  // own „Razem", and reading the wrong one would pass on a blank investor table.
  const breakdown = page
    .locator('div[style*="grid-template-columns"]')
    .filter({ hasText: 'Wydatki inwestycyjne' })
    .first()
  await expect(breakdown).toBeVisible()
  await expect(page.getByText('Brak wydatków inwestycyjnych na materiały.')).toHaveCount(0)

  // Both figures come from `breakdownRowPair` at the same rate, so the aggregate the Podsumowanie
  // prints has to be the split's own „Razem" — that is the disagreement the hidden table concealed.
  const total = await readGridRow(breakdown, 'Razem')
  const printed = materials.split(' | ').filter(Boolean)
  expect(Object.values(total)).toEqual(expect.arrayContaining(printed))
})
