import { test, expect, type Page } from '@playwright/test'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatNet } from '@/lib/kosztorys/format'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { bare } from './support/money'
import { expandSummaryPanel } from './drivers/kosztorys-grid'
import { openPanelView, readSummaryFigures } from './drivers/settlement'
import { openTransferFilters } from './drivers/transfers'

test.use({ storageState: 'e2e/.auth/user.json' })

type PanelSeed = {
  investment: number
  name: string
  laborCostsNet: number
  deposit: number
  materials: number
}

let seed: PanelSeed

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<PanelSeed>('seed:panel-filter-blind', 'PANEL_SEED')
  await refreshReferenceData(browser)
})

const PANEL_FIGURES = [
  'Robocizna',
  'Rabat',
  'Materiały',
  'Łącznie',
  'Wpłaty',
  'Pozostało do zapłaty',
]

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

async function readPanelFigures(page: Page): Promise<Record<string, string>> {
  const figures = await readSummaryFigures(page)
  return Object.fromEntries(PANEL_FIGURES.map((label) => [label, figures[label]]))
}

async function readFilteredSum(page: Page): Promise<string> {
  await openTransferFilters(page)
  const stat = page.getByRole('button', { name: /Suma wybranych transakcji/ })
  await expect(stat).toBeVisible()
  return bare((await stat.textContent()) ?? '')
}

test('the panel states the whole investment while the table below it follows the URL filter', async ({
  page,
}) => {
  await page.goto(`/inwestycje/${seed.investment}`)
  const baselineSettlement = await readPanelFigures(page)
  for (const label of PANEL_FIGURES) {
    expect(baselineSettlement[label], `„${label}" is missing from the panel`).toBeTruthy()
  }
  // „Wpłaty" is the one figure that passes through untouched — materiały carry the investment's
  // stawka and robocizna its rabat, so only this one can be asserted against a seeded amount.
  expect(bare(baselineSettlement['Wpłaty'])).toContain(bare(formatNet(seed.deposit)))

  expect(await page.locator('div[style*="grid-template-columns"] sup').count()).toBe(0)

  await openPanelView(page, 'Marża')
  const baselineMargin = await readSummaryFigures(page)
  expect(baselineMargin['Marża']).toBeTruthy()

  // `usePersistedEnum` hands the server render the FALLBACK, so every navigation paints Podsumowanie once before the stored view arrives.
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTOR_DEPOSIT`)
  await expect(page.getByRole('radio', { name: 'Marża', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(await readSummaryFigures(page)).toEqual(baselineMargin)

  await openPanelView(page, 'Podsumowanie')
  expect(await readPanelFigures(page)).toEqual(baselineSettlement)
  expect(await readFilteredSum(page)).toContain(bare(formatPLN(seed.deposit)))

  // Without this half the first comparison could be satisfied by a page that never filtered at all.
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTMENT_EXPENSE`)
  expect(await readPanelFigures(page)).toEqual(baselineSettlement)
  expect(await readFilteredSum(page)).toContain(bare(formatPLN(seed.materials)))
})

test('„Wpłaty" reads the same on the filtered investment page and in the kosztorys editor', async ({
  page,
}) => {
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTMENT_EXPENSE`)
  await openPanelView(page, 'Podsumowanie')
  const onInvestmentPage = (await readPanelFigures(page))['Wpłaty']
  expect(bare(onInvestmentPage)).toContain(bare(formatNet(seed.deposit)))

  await page.goto(`/inwestycje/${seed.investment}/kosztorys_v2`)
  await expandSummaryPanel(page)
  await openPanelView(page, 'Podsumowanie')

  expect(squash((await readSummaryFigures(page))['Wpłaty'])).toBe(squash(onInvestmentPage))
})

test('the reconciliation mismatch still screams while a filter is applied', async ({ page }) => {
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTOR_DEPOSIT`)
  await openPanelView(page, 'Podsumowanie')

  // Two independent verdicts: robocizna (booked 450 against a kosztorys 500) and rabat (booked 30
  // against a kosztorys 0).
  await expect(page.getByLabel('Niezgodność z transakcjami')).toHaveCount(2)
})
