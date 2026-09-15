import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { formatNet } from '@/lib/kosztorys/format'
import {
  applyDiscountValue,
  bare,
  collapseSummaryPanel,
  columnHeaders,
  expandSummaryPanel,
  gridRow,
  openEditor,
  openPanelView,
  openSettlementOptions,
  pickDiscountMode,
  readSummaryFigures,
  rowCell,
  seedGridInvestments,
  type GridSeedT,
} from './helpers'

// EX-502 — the rabat globalny against the per-item rabat it is supposed to override.
//
// The issue was filed against a two-mode global figure („kwota zł" / „procent %") whose risk was two
// total surfaces disagreeing. Both premises moved since. There is one totals surface now (the panel;
// the old persistent bar is a toggle carrying no figure), and „%" stopped being a stored global mode:
// it is a one-shot that stamps the same percent into every pozycja's own rabat and stores nothing.
// So what is left of the issue — and what still has no guard below the browser — is the OVERRIDE
// itself, from both directions:
//
//   • „Kwotowy" bypasses the per-item rabat WITHOUT deleting it (calc.ts `applyDiscount` short-circuits
//     on `globalDiscountActive`) and pulls the four rabat columns out of the grid, because a printed
//     „Rabat 10 %" beside „Kwota rabatu 0,00" would be a lie on the offer itself. Going back to
//     „Wyłączony" has to bring both the columns and their effect back — the data was never touched.
//   • „%" does the opposite: it OVERWRITES, irreversibly, and asks first.
//
// The arithmetic (`globalDiscountAmount`, `applyDiscount`, `isGlobalDiscountActive`) is unit-covered
// in `kosztorys-calc.test.ts`, and the column gate is a pure function tested in isolation. What no
// layer below the browser holds is the wiring between them: that one pick in „Opcje rozliczenia"
// reaches the real datasheet-grid's columns AND the panel's figures in the same render, off one
// optimistic source, with no reload — and that what the DB kept is what comes back on one.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: GridSeedT

// Two investments, because the percent test overwrites every rabat on its own one while the first
// test asserts exact figures.
test.beforeAll(async ({ browser }) => {
  seed = await seedGridInvestments(browser)
})

// Seeded: three prace, przedmiar 10 at 100 zł, 2 done on „Etap 1" — so the executed robocizna is
// 3 × 2 × 100 before any rabat, and each pozycja's own rabat comes off its row value.
const PRICE = 100
const QTY_DONE = 2
const ROWS = ['Praca jeden', 'Praca dwa', 'Praca trzy'] as const
const EXECUTED_NET = ROWS.length * QTY_DONE * PRICE

const DISCOUNT_TYPE_COLUMN = COLUMN_LABELS.discountType
const DISCOUNT_VALUE_COLUMN = COLUMN_LABELS.discountValue

const PER_ITEM_DISCOUNT = 50
const GLOBAL_DISCOUNT = 120
const PERCENT = 10

// The panel's figures, read with the panel open and folded away again — left open, it would swallow
// every later cell click.
async function summaryFigures(page: Page): Promise<Record<string, string>> {
  await expandSummaryPanel(page)
  // The view pick is persisted per user and the auth state is shared across specs, so the tab this
  // one reads has to be asked for rather than assumed.
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)
  await collapseSummaryPanel(page)
  return figures
}

// One settlement line, compared stripped of the spaces pl-PL groups thousands with. `toContain`
// rather than equality: a both-planes investment renders netto and brutto in one row, and only the
// netto figure is the one under test here.
function expectLine(figures: Record<string, string>, label: string, amount: number): void {
  expect(bare(figures[label] ?? ''), `„${label}"`).toContain(bare(formatNet(amount)))
}

async function setPerItemDiscount(page: Page, row: string, amount: number): Promise<void> {
  const typeCell = await rowCell(page, row, DISCOUNT_TYPE_COLUMN)
  await typeCell.click()
  await page.getByRole('menuitem', { name: 'zł', exact: true }).click()
  await expect(typeCell).toHaveText('zł')

  const valueCell = await rowCell(page, row, DISCOUNT_VALUE_COLUMN)
  await valueCell.click()
  await valueCell.locator('input').fill(String(amount))
  await page.keyboard.press('Enter')
}

test('rabat globalny wyłącza rabaty per pozycja, nie kasując ich', async ({ page }) => {
  // Four route renders plus a reload, each re-fetching the whole kosztorys.
  test.slow()

  await openEditor(page, seed.writes)

  // The instrument's known-positive: the rabat columns are on screen and the per-item rabat is what
  // moves the total. Without this, „the columns are gone" later would also pass on a grid that never
  // rendered them and a total that never counted a rabat.
  expect(await columnHeaders(page)).toContain(DISCOUNT_TYPE_COLUMN)
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET)

  await setPerItemDiscount(page, ROWS[0], PER_ITEM_DISCOUNT)
  const withPerItem = await summaryFigures(page)
  expectLine(withPerItem, 'Robocizna', EXECUTED_NET)
  expectLine(withPerItem, 'Rabat', -PER_ITEM_DISCOUNT)
  expectLine(withPerItem, 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  // --- „Kwotowy": the columns go, the figure does not ---
  // Entering the mode seeds the kwota with the per-item total (`globalDiscountForMode`), so the deal
  // on screen is unchanged at the moment of the switch — which is the point: the owner picks a mode,
  // not a new price. What changes is WHERE the rabat comes from, and that is visible in the grid.
  await openSettlementOptions(page)
  await pickDiscountMode(page, 'Kwotowy')
  await page.keyboard.press('Escape')

  const headers = await columnHeaders(page)
  expect(headers).not.toContain(DISCOUNT_TYPE_COLUMN)
  expect(headers).not.toContain(DISCOUNT_VALUE_COLUMN)

  const seeded = await summaryFigures(page)
  expectLine(seeded, 'Rabat', -PER_ITEM_DISCOUNT)
  expectLine(seeded, 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  // Now move the kwota. Only the global figure can answer for this: the pozycja still carries 50 zł.
  await openSettlementOptions(page)
  await applyDiscountValue(page, GLOBAL_DISCOUNT)
  await page.keyboard.press('Escape')

  const global = await summaryFigures(page)
  expectLine(global, 'Rabat', -GLOBAL_DISCOUNT)
  expectLine(global, 'Łącznie', EXECUTED_NET - GLOBAL_DISCOUNT)

  // --- „Wyłączony": both the columns and the 50 zł come back ---
  // The bypass is the whole contract — had the switch cleared the pozycje instead, this would read
  // the undiscounted total with the columns back and nothing in them.
  await openSettlementOptions(page)
  await pickDiscountMode(page, 'Wyłączony')
  await page.keyboard.press('Escape')

  expect(await columnHeaders(page)).toContain(DISCOUNT_TYPE_COLUMN)
  await expect(await rowCell(page, ROWS[0], DISCOUNT_TYPE_COLUMN)).toHaveText('zł')
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  // The grid seeds its rows into `useState` at mount, so „it is on screen" and „it is in Postgres"
  // are two different facts about that 50 zł. Only the reload answers the second.
  await page.reload()
  await collapseSummaryPanel(page)
  await expect(await rowCell(page, ROWS[0], DISCOUNT_VALUE_COLUMN)).toContainText(
    String(PER_ITEM_DISCOUNT),
  )
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)
})

test('tryb „%" nadpisuje rabat każdej pozycji i pyta, zanim to zrobi', async ({ page }) => {
  test.slow()

  await openEditor(page, seed.live)
  await setPerItemDiscount(page, ROWS[0], PER_ITEM_DISCOUNT)

  await openSettlementOptions(page)
  await pickDiscountMode(page, '%')
  await applyDiscountValue(page, PERCENT)

  // The dialog stands in for undo, which this write has none of — so it is part of the contract, not
  // chrome. It is offered only because a rabat exists to lose.
  await page.getByRole('button', { name: 'Nadpisz rabaty' }).click()
  await page.keyboard.press('Escape')

  // Every pozycja, not just the one that had a rabat — „Praca dwa" and „Praca trzy" had none, and
  // that is what makes this a stamp rather than a rescale. The columns stay: „%" stores no global
  // rabat, so nothing is being overridden afterwards.
  await collapseSummaryPanel(page)
  for (const row of ROWS) {
    await expect(await rowCell(page, row, DISCOUNT_TYPE_COLUMN)).toHaveText('%')
    await expect(await rowCell(page, row, DISCOUNT_VALUE_COLUMN)).toContainText(String(PERCENT))
  }
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET * (1 - PERCENT / 100))

  // One action wrote every row, so the reload is the only read that proves it wrote them all.
  await page.reload()
  await collapseSummaryPanel(page)
  for (const row of ROWS) {
    await expect(gridRow(page, row)).toHaveCount(1)
    await expect(await rowCell(page, row, DISCOUNT_VALUE_COLUMN)).toContainText(String(PERCENT))
  }
})
