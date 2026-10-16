import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { formatNet } from '@/lib/kosztorys/format'
import { type GridSeedT, seedGridInvestments } from './support/seeds'
import { settleWrites } from './support/wait'
import {
  collapseSummaryPanel,
  commitCellValue,
  expandSummaryPanel,
  expectCellValue,
  gridRow,
  openEditor,
  rowCell,
} from './drivers/kosztorys-grid'

test.use({ storageState: 'e2e/.auth/user.json' })

let seed: GridSeedT

// Two investments of one shape, one per test: the write test types over the rozpiska the read test
// asserts exact figures on.
test.beforeAll(async ({ browser }) => {
  seed = await seedGridInvestments(browser)
})

const SUM_COLUMN = COLUMN_LABELS.stageQtySum
const REMAINING_COLUMN = COLUMN_LABELS.remaining
const PLANNED_COLUMN = COLUMN_LABELS.plannedQty

// Seeded: przedmiar 10 × 100 zł, with 2 done on „Etap 1" and „Etap 2" empty.
const PRICE = 100
const PLANNED_QTY = 10
const SEEDED_DONE = 2

async function typeStageQty(
  page: Page,
  rowText: string,
  stage: string,
  qty: number,
): Promise<void> {
  const cell = await rowCell(page, rowText, stage)
  await commitCellValue(cell, String(qty))
}

// A prefetch carries the same header and is excluded by its own.
function countRouteRefreshes(page: Page, pathname: string): () => number {
  let refreshes = 0
  page.on('request', (request) => {
    const headers = request.headers()
    if (headers['rsc'] !== '1' || headers['next-router-prefetch'] === '1') return
    if (new URL(request.url()).pathname !== pathname) return
    refreshes += 1
  })
  return () => refreshes
}

test('„Pomiar z natury (etapy razem)" cannot be typed into and follows the etapy live', async ({
  page,
}) => {
  await openEditor(page, seed.live)

  const sumCell = await rowCell(page, 'Praca jeden', SUM_COLUMN)
  const remainingCell = await rowCell(page, 'Praca jeden', REMAINING_COLUMN)
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE))
  await expect(remainingCell).toHaveText(formatNet((PLANNED_QTY - SEEDED_DONE) * PRICE))

  await expect((await rowCell(page, 'Praca jeden', PLANNED_COLUMN)).locator('input')).toHaveCount(1)
  await expect(sumCell.locator('input')).toHaveCount(0)

  await sumCell.click()
  await page.keyboard.type('99')
  await page.keyboard.press('Enter')
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE))

  await typeStageQty(page, 'Praca jeden', 'Etap 2', 5)
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE + 5))
  await expect(remainingCell).toHaveText(formatNet((PLANNED_QTY - SEEDED_DONE - 5) * PRICE))

  await expect(await rowCell(page, 'Praca dwa', SUM_COLUMN)).toHaveText(formatNet(SEEDED_DONE))
})

test('a run of cell edits reaches Postgres and refetches the route at most once per cell', async ({
  page,
}) => {
  const pathname = `/inwestycje/${seed.writes}/kosztorys_v2`
  await openEditor(page, seed.writes)
  const refreshes = countRouteRefreshes(page, pathname)

  const typed = [
    { row: 'Praca jeden', qty: 1 },
    { row: 'Praca dwa', qty: 2 },
    { row: 'Praca trzy', qty: 3 },
  ]
  // The burst as a whole is then waited out per write: a reload taken on one response
  // aborts the debounces still pending, and two of the three values never reach Postgres.
  await settleWrites(page, typed.length, async () => {
    for (const { row, qty } of typed) await typeStageQty(page, row, 'Etap 2', qty)
  })

  const executedNet = typed.reduce((sum, { qty }) => sum + (SEEDED_DONE + qty) * PRICE, 0)
  await expandSummaryPanel(page)
  await expect(page.getByText(formatNet(executedNet)).first()).toBeVisible({ timeout: 20_000 })

  // A stage-quantity autosave defers its tag's expiry (`EXPIRE_NEXT`), so its response carries no
  // render and the router follows it with ONE refetch.
  expect(refreshes()).toBeGreaterThanOrEqual(1)
  expect(refreshes()).toBeLessThanOrEqual(typed.length)

  // The grid seeds its rows into `useState` at mount, so „the value is on screen" and „the value is
  // in Postgres" are two different facts.
  await page.reload()
  await collapseSummaryPanel(page)
  for (const { row, qty } of typed) {
    await expectCellValue(await rowCell(page, row, 'Etap 2'), String(qty))
    await expect(await rowCell(page, row, SUM_COLUMN)).toHaveText(formatNet(SEEDED_DONE + qty))
  }
  await expect(gridRow(page, 'Praca jeden')).toHaveCount(1)
})
