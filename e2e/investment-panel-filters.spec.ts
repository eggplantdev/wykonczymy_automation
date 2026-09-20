import { test, expect, type Page } from '@playwright/test'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatNet } from '@/lib/kosztorys/format'
import {
  bare,
  expandSummaryPanel,
  openPanelView,
  openTransferFilters,
  readSummaryFigures,
  refreshReferenceData,
  runSeedScript,
} from './helpers'

// EX-634 — the v2 investment panel is wholly filter-blind.
//
// `InvestmentSummaryPanel` scopes every one of its own fetches to `{ investment }` and never reads
// the page's URL transfer filters; the transfers table's „Suma wybranych transakcji" below it is the
// one surface answering the filtered question. Nothing in the type system holds that apart — the
// panel's figures are derived server-side in an RSC behind `<Suspense>`, so a future edit threading a
// filtered `Where` into it type-checks, passes every unit test, and quietly makes the panel answer a
// different question than its caption claims. The risk is exactly „load the page with a filter
// applied and read the numbers", so the browser is the only instrument.
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

// The six settlement figures this panel exists to state. Named rather than compared wholesale, so a
// failure says WHICH figure moved — and so a row that disappears fails the completeness check below
// instead of silently comparing undefined to undefined.
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

// The one surface on this page that IS supposed to answer the filtered question. It renders only
// while a filter is active, and it is a disabled button whose accessible name concatenates the label
// with the amount — so read its text and compare stripped of the thin spaces Intl's PLN puts in.
async function readFilteredSum(page: Page): Promise<string> {
  await openTransferFilters(page)
  const stat = page.getByRole('button', { name: /Suma wybranych transakcji/ })
  await expect(stat).toBeVisible()
  return bare((await stat.textContent()) ?? '')
}

test('the panel states the whole investment while the table below it follows the URL filter', async ({
  page,
}) => {
  // Unfiltered — the reading every filtered load below must reproduce byte for byte.
  await page.goto(`/inwestycje/${seed.investment}`)
  const baselineSettlement = await readPanelFigures(page)
  for (const label of PANEL_FIGURES) {
    expect(baselineSettlement[label], `„${label}" is missing from the panel`).toBeTruthy()
  }
  // Sanity on the fixture itself: a panel reading 0,00 everywhere would compare equal to anything.
  // „Wpłaty" is the one figure that passes through untouched — materiały carry the investment's
  // stawka and robocizna its rabat, so only this one can be asserted against a seeded amount.
  expect(bare(baselineSettlement['Wpłaty'])).toContain(bare(formatNet(seed.deposit)))

  // EX-600's apparatus — an asterisk marking the figures the filters couldn't reach — is deleted.
  // It must not come back: the panel answers one question, so it needs no footnote saying which.
  expect(await page.locator('div[style*="grid-template-columns"] sup').count()).toBe(0)

  await openPanelView(page, 'Marża')
  const baselineMargin = await readSummaryFigures(page)
  expect(baselineMargin['Marża']).toBeTruthy()

  // A filter narrowing the table to the single seeded wpłata. The view pick is persisted, so the
  // page comes back on „Marża" — read it before switching away. Awaited rather than assumed: the
  // pick lives in localStorage and `usePersistedEnum` hands the server render the FALLBACK, so every
  // navigation paints Podsumowanie once before the stored view arrives. Reading straight after the
  // goto compared the two views and blamed the filter.
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTOR_DEPOSIT`)
  await expect(page.getByRole('radio', { name: 'Marża', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(await readSummaryFigures(page)).toEqual(baselineMargin)

  await openPanelView(page, 'Podsumowanie')
  expect(await readPanelFigures(page)).toEqual(baselineSettlement)
  expect(await readFilteredSum(page)).toContain(bare(formatPLN(seed.deposit)))

  // A second, disjoint filter: the sum below changes because it is supposed to, the panel does not.
  // Without this half the first comparison could be satisfied by a page that never filtered at all.
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTMENT_EXPENSE`)
  expect(await readPanelFigures(page)).toEqual(baselineSettlement)
  expect(await readFilteredSum(page)).toContain(bare(formatPLN(seed.materials)))
})

test('„Wpłaty" reads the same on the filtered investment page and in the kosztorys editor', async ({
  page,
}) => {
  // The regression this slice actually fixed: the two surfaces stood on different fetches, so a
  // filter moved one and not the other. Both now sit on `fetchDepositTransactionsForInvestment`.
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
  // The scream compares the kosztorys against the booked LABOR_COST / RABAT rows — a whole-investment
  // verdict. It was previously muted whenever a filter was active, which silenced it on exactly the
  // screen someone reaches by drilling into the transactions they are trying to reconcile.
  await page.goto(`/inwestycje/${seed.investment}?type=INVESTOR_DEPOSIT`)
  await openPanelView(page, 'Podsumowanie')

  // Two independent verdicts: robocizna (booked 450 against a kosztorys 500) and rabat (booked 30
  // against a kosztorys 0). Both rows carry their own alarm, so a single icon means one went quiet.
  await expect(page.getByLabel('Niezgodność z transakcjami')).toHaveCount(2)
})
