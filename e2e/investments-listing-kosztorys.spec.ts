import { test, expect, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import {
  collapseSummaryPanel,
  editorCell,
  readListingFigure,
  seedReconInvestments,
  type ReconSeedT,
} from './helpers'

// The staleness guard for the read-switch (EX-555): since the listing reads robocizna from the
// kosztorys, a kosztorys write has to invalidate the listing's cached figures. Nothing below the
// browser can see that — the SQL is right, the TS is right, and the page still shows yesterday's
// number because the write never touched the tag the listing is cached under.
//
// So the one thing this spec must never do is click „Odśwież dane" between the edit and the read.
// That button revalidates the whole layout by hand; a test that presses it proves the app can be
// forced to be correct, which is not the property in question.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: ReconSeedT

// Reuses the reconciliation seed: its „match" investment is one no-discount item at 100 × qtyDone 5,
// so „Suma prac wykonanych" is exactly 500 and a qty change moves marża by a number we can name.
test.beforeAll(async ({ browser }) => {
  seed = await seedReconInvestments(browser)
})

// Marża for the seeded investment, read off the listing (ADMIN/OWNER only — the E2E user is OWNER).
const readMargin = (page: Page, investmentName: string) =>
  readListingFigure(page, investmentName, 'Marża')

async function setStageQty(page: Page, investmentId: number, qty: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  const summaryToggle = await collapseSummaryPanel(page)

  const cell = await editorCell(page, 'Etap 1')
  await cell.click()
  await cell.locator('input').fill(String(qty))
  await page.keyboard.press('Enter')

  // The write is a server action fired from the grid. Confirm it landed HERE — otherwise a listing
  // that never moved could mean the edit never happened, and the spec would blame the cache.
  await summaryToggle.click()
  await expect(page.getByText(formatNet(qty * 100)).first()).toBeVisible({ timeout: 15_000 })
}

test('a kosztorys qty change moves marża on the listing without a manual refresh', async ({
  page,
}) => {
  const before = await readMargin(page, seed.matchName)

  await setStageQty(page, seed.match, 10)

  // Straight back to the listing — no „Odśwież dane". The delta is the seeded item's client price
  // times the added quantity: 100 × 5.
  await expect.poll(() => readMargin(page, seed.matchName), { timeout: 20_000 }).toBe(before + 500)
})
