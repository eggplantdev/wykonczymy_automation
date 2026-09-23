import { test, expect, type Page } from '@playwright/test'
import { parsePln, pickComboOption, readListingFigure, uniqueAmount } from './support/ui'
import { waitForHydration } from './support/wait'
import {
  ensureSettlementMode,
  openPanelView,
  readInvestorBalance,
  readSummaryFigures,
} from './drivers/settlement'

// EX-684 — strata is the one figure three separate mechanisms each fold into the client's debt:
// `calculateBalance` behind the listing's „Bilans netto v1", the Σ of the v1 header tiles (a pure
// client sum, so the browser is the only place it exists at all), and `computeAmountDue` behind the
// v2 „Pozostało do zapłaty". Each formula is unit-tested on its own; what no unit test can see is
// that ONE booking reaches all three — three different cached reads, two different pages, one write.
// A term dropped from one of them still renders a number, and the number is a debt the client is
// asked to pay.
//
// The second thing only a browser shows: strata deducts at FACE VALUE, also on brutto. A rabat is a
// concession on the price and grosses by VAT; a strata never crossed a VAT bridge, so brutto falls by
// exactly the kwota booked rather than 1,23× it. The tryb decides which single column EXISTS
// (`settlementModeToMoneyAxis` — „Mieszane" settles on netto like tryb netto), so brutto is readable
// in tryb brutto and nowhere else, and that is the one tryb where the two concessions differ at all.
test.use({ storageState: 'e2e/.auth/user.json' })

// Long-standing dump investments, chosen rather than seeded for the reason `kosztorys_v2` forces:
// it resolves the investment off `fetchReferenceData`, whose cache no seed script can invalidate
// from outside the server process, so a freshly created investment 404s there. LOSS_INVESTMENT
// carries a 377-pozycja kosztorys with no transfers, so the debt the settlement prints is real; the
// brutto test switches its tryb itself. CLEAN_INVESTMENT has never had a strata, and never gets one here: it is the
// control for „no strata, no step", which the loss-booking investment can never re-assert once this
// spec has run against it (the test DB is never reset).
//
// The control needs a KOSZTORYS as much as it needs a clean history: with none, v2 reads 0 zł and the
// panel prints no settlement at all, so „no strata step" would pass on a page that renders no steps
// whatsoever. „Foksal 12/14" (134) was the control until it turned out to carry zero pozycji.
const LOSS_INVESTMENT = { id: 137, name: 'testowe inwestycje' }
const CLEAN_INVESTMENT = { id: 106, name: 'Sulmierzycka 6/29 - poprawki' }

// Book a strata through the global „Wydatek" dialog — the real route, so the write goes through the
// server action and its revalidation rather than a seed that bypasses both. Opened from the
// investment's own page, so the form seeds the investment from the URL; the type is picked FIRST
// because switching it re-runs `resetConditionalFields`, which rewrites the investment field.
async function bookLoss(page: Page, investmentName: string, amount: number): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  await trigger.click()

  await page.getByText('Nowy wydatek').first().waitFor()
  await page.getByLabel('Typ wydatku', { exact: true }).click()
  await page.getByRole('option', { name: 'Strata', exact: true }).click()
  // A strata carries no kasa and no kategoria — it is a cost the company swallowed, not a cash
  // movement — so the investment and the kwota are the whole form.
  await pickComboOption(page, 'Inwestycja', investmentName)
  await page.getByLabel('Kwota').first().fill(amount.toFixed(2))
  await page.locator('[id="lineItems[0].description"]').fill(`E2E strata ${Date.now()}`)

  // `exact`, because „Zapisz jako domyślną kasę" sits in the same dialog on other types.
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await page.getByText('Nowy wydatek').first().waitFor({ state: 'hidden' })
}

// „Pozostało do zapłaty" and the „Strata" step above it, on the one money column the tryb projects.
// The strata step is absent until the investment has one, so it reads 0 zł.
async function readSettlement(
  page: Page,
  investmentId: number,
): Promise<{ due: number; loss: number }> {
  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)
  const due = figures['Pozostało do zapłaty']
  expect(due, `no „Pozostało do zapłaty" step on inwestycja ${investmentId}`).toBeTruthy()
  return { due: parsePln(due), loss: parsePln(figures['Strata'] ?? '0') }
}

test('a booked strata raises the investor balance by the same kwota on the listing and on the investment page', async ({
  page,
}) => {
  const amount = uniqueAmount()

  const listingBefore = await readListingFigure(page, LOSS_INVESTMENT.name, 'Bilans netto v1')
  await page.goto(`/inwestycje/${LOSS_INVESTMENT.id}?widok=v1`)
  const headerBefore = await readInvestorBalance(page)
  // The two readings are computed by different code on different pages; the arithmetic that keeps
  // them equal is unit-tested, so a disagreement HERE means one of them was served stale.
  expect(headerBefore).toBeCloseTo(listingBefore, 2)

  await bookLoss(page, LOSS_INVESTMENT.name, amount)

  // A strata is a cost the client stops owing, so the balance RISES by it. No „Odśwież dane"
  // anywhere — `expect.poll` allows for the revalidation to land, not for a manual refresh.
  await expect
    .poll(() => readListingFigure(page, LOSS_INVESTMENT.name, 'Bilans netto v1'), {
      timeout: 20_000,
    })
    .toBeCloseTo(listingBefore + amount, 2)

  await page.goto(`/inwestycje/${LOSS_INVESTMENT.id}?widok=v1`)
  expect(await readInvestorBalance(page)).toBeCloseTo(headerBefore + amount, 2)

  // The header total is summed in the browser from the tiles, and unticking one drops it from the
  // sum — the one mechanism of the three that exists nowhere but in a rendered page.
  const tile = page.getByRole('button', { name: /^Strata:/ })
  await waitForHydration(tile)
  const tileAmount = parsePln((await tile.textContent()) ?? '')
  await tile.click()
  await expect
    .poll(() => readInvestorBalance(page))
    .toBeCloseTo(headerBefore + amount - tileAmount, 2)
})

test('a strata deducts at face value on the brutto plane of the v2 settlement', async ({
  page,
}) => {
  const amount = uniqueAmount()
  // Tryb brutto, because the settled column is the only money column that renders and brutto is the
  // one plane where a strata and a rabat part ways — in netto both simply come off at face value.
  await ensureSettlementMode(page, LOSS_INVESTMENT.id, 'Brutto')

  const before = await readSettlement(page, LOSS_INVESTMENT.id)

  await bookLoss(page, LOSS_INVESTMENT.name, amount)

  // Brutto falls by exactly the booked kwota, NOT by 1,23× it.
  await expect
    .poll(async () => (await readSettlement(page, LOSS_INVESTMENT.id)).due, { timeout: 20_000 })
    .toBeCloseTo(before.due - amount, 2)

  // And the deduction is its own named step, not folded into „Wpłaty" — the client reads this table
  // top-down, so a strata hidden inside the wpłaty would misstate what was actually paid. It renders
  // negative (a subtracted step), hence the widening magnitude.
  const after = await readSettlement(page, LOSS_INVESTMENT.id)
  expect(after.loss).toBeCloseTo(before.loss - amount, 2)
})

test('an investment with no strata prints no strata step', async ({ page }) => {
  await page.goto(`/inwestycje/${CLEAN_INVESTMENT.id}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)

  // A 0 zł step is worse than no step: it invites the reader to look for a strata that isn't there.
  // The last line is „Pozostało do zapłaty" or „Nadpłata" depending on which side of zero the deal
  // sits on — this fixture is overpaid, and either label proves the settlement rendered.
  expect(
    figures['Pozostało do zapłaty'] ?? figures['Nadpłata'],
    'the panel rendered no settlement at all',
  ).toBeTruthy()
  expect(figures['Strata']).toBeUndefined()
})
