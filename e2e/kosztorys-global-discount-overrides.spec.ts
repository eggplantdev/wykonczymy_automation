import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { formatNet } from '@/lib/kosztorys/format'
import { type GridSeedT, seedGridInvestments } from './support/seeds'
import { bare } from './support/money'
import {
  collapseSummaryPanel,
  columnHeaders,
  commitCellValue,
  expandSummaryPanel,
  expectCellValue,
  gridRow,
  openEditor,
  rowCell,
} from './drivers/kosztorys-grid'
import {
  applyDiscountAmount,
  applyDiscountPercent,
  openPanelView,
  openSettlementOptions,
  pickDiscountMode,
  readSummaryFigures,
} from './drivers/settlement'

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

// `toContain` rather than equality: a both-planes investment renders netto and brutto in one row.
function expectLine(figures: Record<string, string>, label: string, amount: number): void {
  expect(bare(figures[label] ?? ''), `„${label}"`).toContain(bare(formatNet(amount)))
}

async function setPerItemDiscount(page: Page, row: string, amount: number): Promise<void> {
  const typeCell = await rowCell(page, row, DISCOUNT_TYPE_COLUMN)
  await typeCell.click()
  await page.getByRole('menuitem', { name: 'zł', exact: true }).click()
  await expect(typeCell).toHaveText('zł')

  const valueCell = await rowCell(page, row, DISCOUNT_VALUE_COLUMN)
  await commitCellValue(valueCell, String(amount))
}

test('rabat globalny wyłącza rabaty per pozycja, nie kasując ich', async ({ page }) => {
  // Four route renders plus a reload, each re-fetching the whole kosztorys.
  test.slow()

  await openEditor(page, seed.writes)

  expect(await columnHeaders(page)).toContain(DISCOUNT_TYPE_COLUMN)
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET)

  await setPerItemDiscount(page, ROWS[0], PER_ITEM_DISCOUNT)
  const withPerItem = await summaryFigures(page)
  expectLine(withPerItem, 'Robocizna', EXECUTED_NET)
  expectLine(withPerItem, 'Rabat', -PER_ITEM_DISCOUNT)
  expectLine(withPerItem, 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  // Entering the mode seeds the kwota with the per-item total (`globalDiscountForMode`), so the deal
  // on screen is unchanged at the moment of the switch.
  await openSettlementOptions(page)
  await pickDiscountMode(page, 'Kwotowy')
  await page.keyboard.press('Escape')

  const headers = await columnHeaders(page)
  expect(headers).not.toContain(DISCOUNT_TYPE_COLUMN)
  expect(headers).not.toContain(DISCOUNT_VALUE_COLUMN)

  const seeded = await summaryFigures(page)
  expectLine(seeded, 'Rabat', -PER_ITEM_DISCOUNT)
  expectLine(seeded, 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  await openSettlementOptions(page)
  await applyDiscountAmount(page, GLOBAL_DISCOUNT)
  await page.keyboard.press('Escape')

  const global = await summaryFigures(page)
  expectLine(global, 'Rabat', -GLOBAL_DISCOUNT)
  expectLine(global, 'Łącznie', EXECUTED_NET - GLOBAL_DISCOUNT)

  await openSettlementOptions(page)
  await pickDiscountMode(page, 'Wyłączony')
  await page.keyboard.press('Escape')

  expect(await columnHeaders(page)).toContain(DISCOUNT_TYPE_COLUMN)
  await expect(await rowCell(page, ROWS[0], DISCOUNT_TYPE_COLUMN)).toHaveText('zł')
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET - PER_ITEM_DISCOUNT)

  // The grid seeds its rows into `useState` at mount, so „it is on screen" and „it is in Postgres"
  // are two different facts about that 50 zł.
  await page.reload()
  await collapseSummaryPanel(page)
  await expectCellValue(
    await rowCell(page, ROWS[0], DISCOUNT_VALUE_COLUMN),
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
  await applyDiscountPercent(page, PERCENT)

  await page.getByRole('button', { name: 'Nadpisz rabaty' }).click()
  await page.keyboard.press('Escape')

  await collapseSummaryPanel(page)
  for (const row of ROWS) {
    await expect(await rowCell(page, row, DISCOUNT_TYPE_COLUMN)).toHaveText('%')
    await expectCellValue(await rowCell(page, row, DISCOUNT_VALUE_COLUMN), String(PERCENT))
  }
  expectLine(await summaryFigures(page), 'Łącznie', EXECUTED_NET * (1 - PERCENT / 100))

  await page.reload()
  await collapseSummaryPanel(page)
  for (const row of ROWS) {
    await expect(gridRow(page, row)).toHaveCount(1)
    await expectCellValue(await rowCell(page, row, DISCOUNT_VALUE_COLUMN), String(PERCENT))
  }
})
