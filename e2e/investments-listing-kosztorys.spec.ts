import { test, expect, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import { type ReconSeedT, seedReconInvestments } from './support/seeds'
import { readListingFigure } from './support/table'
import { settleWrite } from './support/wait'
import {
  collapseSummaryPanel,
  commitCellValue,
  editorCell,
  expandSummaryPanel,
} from './drivers/kosztorys-grid'

// So the one thing this spec must never do is click „Odśwież dane" between the edit and the read.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: ReconSeedT

// Reuses the reconciliation seed: its „match" investment is one no-discount item at 100 × qtyDone 5,
// so „Suma prac wykonanych" is exactly 500 and a qty change moves marża by a number we can name.
test.beforeAll(async ({ browser }) => {
  seed = await seedReconInvestments(browser)
})

const readKosztorysLabor = (page: Page, investmentName: string) =>
  readListingFigure(page, investmentName, 'Robocizna v2')

async function setStageQty(page: Page, investmentId: number, qty: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  await collapseSummaryPanel(page)

  const cell = await editorCell(page, 'Etap 1')
  await settleWrite(page, async () => {
    await commitCellValue(cell, String(qty))
  })

  // Confirm it landed HERE — otherwise a listing that never moved could mean the edit never happened, and the spec would blame the cache.
  await expandSummaryPanel(page)
  await expect(page.getByText(formatNet(qty * 100)).first()).toBeVisible({ timeout: 15_000 })
}

test('a kosztorys qty change moves the listing figure without a manual refresh', async ({
  page,
}) => {
  const before = await readKosztorysLabor(page, seed.matchName)

  await setStageQty(page, seed.match, 10)

  await expect
    .poll(() => readKosztorysLabor(page, seed.matchName), { timeout: 20_000 })
    .toBe(before + 500)
})
