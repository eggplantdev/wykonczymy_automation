import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { formatNet } from '@/lib/kosztorys/format'
import {
  collapseSummaryPanel,
  gridRow,
  openEditor,
  rowCell,
  seedGridInvestments,
  type GridSeedT,
} from './helpers'

// EX-497 (the read) and EX-604 (the write) — the same grid, its two directions.
//
// EX-497: „Pomiar (razem etapy)" stopped being a typed figure and became the live sum of the stage
// cells (the owner's sheet has O = SUM(D:M)). The arithmetic is unit-covered; what no layer below
// the browser reaches is the WIRING — that the column renders as a locked computed cell in the real
// datasheet-grid and recomputes on a stage edit without a reload.
//
// EX-604: `deferRefresh` made the per-cell autosave expire cache tags WITHOUT re-rendering the route
// that fired it. That is the whole point of it, and it is also why a broken write is invisible in the
// session that made it: the grid keeps rendering the typed value out of its own local `rows` state
// whether or not anything ever reached Postgres. So the only honest read of „it saved" is a reload,
// and the only honest read of „it coalesced" is counting the route refreshes the burst caused.
//
// Risk 3 of EX-604 — another route seeing the invalidation — is already guarded by
// `investments-listing-kosztorys.spec.ts` (marża moves on /inwestycje with no „Odśwież dane"); a
// second copy here would buy nothing.
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
  await cell.click()
  await cell.locator('input').fill(String(qty))
  await page.keyboard.press('Enter')
}

// Count the full-route refreshes the editor asks for. `router.refresh()` re-fetches the CURRENT
// route as an RSC payload, so it is visible as a request to this pathname carrying `RSC: 1` — a
// prefetch carries the same header and is excluded by its own. Counting requests rather than reading
// the hook is deliberate: the cost EX-604 is about is the payload on the wire.
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

test('„Pomiar (razem etapy)" cannot be typed into and follows the etapy live', async ({ page }) => {
  await openEditor(page, seed.live)

  const sumCell = await rowCell(page, 'Praca jeden', SUM_COLUMN)
  const remainingCell = await rowCell(page, 'Praca jeden', REMAINING_COLUMN)
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE))
  await expect(remainingCell).toHaveText(formatNet((PLANNED_QTY - SEEDED_DONE) * PRICE))

  // A computed cell has no input at all, where „Przedmiar" — typed by hand on the same row — does.
  // The control is what makes the absence mean „locked" instead of „the grid never renders inputs".
  await expect((await rowCell(page, 'Praca jeden', PLANNED_COLUMN)).locator('input')).toHaveCount(1)
  await expect(sumCell.locator('input')).toHaveCount(0)

  // And it stays locked when someone tries anyway: dsg refuses the keystrokes on a disabled cell,
  // but „refuses" is only observable by aiming a value at it and finding the figure unmoved.
  await sumCell.click()
  await page.keyboard.type('99')
  await page.keyboard.press('Enter')
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE))

  // The live half: one etap edited, and the sum plus everything anchored to it moves with no reload.
  await typeStageQty(page, 'Praca jeden', 'Etap 2', 5)
  await expect(sumCell).toHaveText(formatNet(SEEDED_DONE + 5))
  await expect(remainingCell).toHaveText(formatNet((PLANNED_QTY - SEEDED_DONE - 5) * PRICE))

  // The neighbour is the proof the recompute is per row and not a repaint of the whole column.
  await expect(await rowCell(page, 'Praca dwa', SUM_COLUMN)).toHaveText(formatNet(SEEDED_DONE))
})

test('a run of cell edits reaches Postgres and refreshes the route once, not once per cell', async ({
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
  for (const { row, qty } of typed) await typeStageQty(page, row, 'Etap 2', qty)

  // The panel's figures come back from the server, so seeing the new total there is the first proof
  // the writes landed — the grid alone would show the typed values either way.
  const executedNet = typed.reduce((sum, { qty }) => sum + (SEEDED_DONE + qty) * PRICE, 0)
  const summaryToggle = await collapseSummaryPanel(page)
  await summaryToggle.click()
  await expect(page.getByText(formatNet(executedNet)).first()).toBeVisible({ timeout: 20_000 })

  // Unfixed, the 700 ms timer was queued per edited cell and every one of them fired: three edits,
  // three full-route refreshes. The assertion is „fewer than the edits", not „exactly one", because
  // an exact count would be an assertion about how fast Playwright types, not about the debounce.
  expect(refreshes()).toBeGreaterThanOrEqual(1)
  expect(refreshes()).toBeLessThan(typed.length)

  // The grid seeds its rows into `useState` at mount, so „the value is on screen" and „the value is
  // in Postgres" are two different facts. Only the reload answers the second one.
  await page.reload()
  await collapseSummaryPanel(page)
  for (const { row, qty } of typed) {
    await expect(await rowCell(page, row, 'Etap 2')).toContainText(String(qty))
    await expect(await rowCell(page, row, SUM_COLUMN)).toHaveText(formatNet(SEEDED_DONE + qty))
  }
  await expect(gridRow(page, 'Praca jeden')).toHaveCount(1)
})
