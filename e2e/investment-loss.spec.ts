import { test, expect, type Page } from '@playwright/test'
import {
  ensureSettlementMode,
  openPanelView,
  parsePln,
  pickComboOption,
  readInvestorBalance,
  readListingFigure,
  readSummaryFigures,
  uniqueAmount,
  waitForHydration,
} from './helpers'

// EX-684 — strata is the one figure three separate mechanisms each fold into the client's debt:
// `calculateBalance` behind the listing's „Bilans netto v1", the Σ of the v1 header tiles (a pure
// client sum, so the browser is the only place it exists at all), and `computeAmountDue` behind the
// v2 „Pozostało do zapłaty". Each formula is unit-tested on its own; what no unit test can see is
// that ONE booking reaches all three — three different cached reads, two different pages, one write.
// A term dropped from one of them still renders a number, and the number is a debt the client is
// asked to pay.
//
// The second thing only a browser shows: strata deducts at FACE VALUE on both planes. A rabat is a
// concession on the price and grosses by VAT; a strata never crossed a VAT bridge, so netto and
// brutto fall by exactly the same kwota. On a tryb-mieszane investment both columns render side by
// side, which is what makes „to samo na netto i na brutto" assertable rather than inferred.
test.use({ storageState: 'e2e/.auth/user.json' })

// Long-standing dump investments, chosen rather than seeded for the reason `kosztorys_v2` forces:
// it resolves the investment off `fetchReferenceData`, whose cache no seed script can invalidate
// from outside the server process, so a freshly created investment 404s there. LOSS_INVESTMENT is
// already tryb mieszane and carries a 377-pozycja kosztorys with no transfers — both planes render
// and the debt is real. CLEAN_INVESTMENT has never had a strata, and never gets one here: it is the
// control for „no strata, no step", which the loss-booking investment can never re-assert once this
// spec has run against it (the test DB is never reset).
const LOSS_INVESTMENT = { id: 137, name: 'testowe inwestycje' }
const CLEAN_INVESTMENT = { id: 134, name: 'Foksal 12/14' }

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
  await page.getByLabel('Typ wydatku').click()
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

// „Pozostało do zapłaty" and the „Strata" step above it, both planes. Under tryb mieszane a
// settlement row renders netto and brutto in one grid row, which `readSummaryFigures` joins with
// „ | ". The strata step is absent until the investment has one, so it reads as a 0 zł pair.
async function readSettlement(
  page: Page,
  investmentId: number,
): Promise<{ due: [number, number]; loss: [number, number] }> {
  await page.goto(`/inwestycje/${investmentId}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)
  const due = figures['Pozostało do zapłaty']
  expect(due, `no „Pozostało do zapłaty" step on inwestycja ${investmentId}`).toBeTruthy()
  const pair = (text: string | undefined): [number, number] => {
    const [net, gross] = (text ?? '0 | 0').split('|').map(parsePln)
    return [net, gross]
  }
  return { due: pair(due), loss: pair(figures['Strata']) }
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

test('a strata deducts at face value on both planes of the v2 settlement', async ({ page }) => {
  const amount = uniqueAmount()
  await ensureSettlementMode(page, LOSS_INVESTMENT.id, 'Mieszane')

  const before = await readSettlement(page, LOSS_INVESTMENT.id)

  await bookLoss(page, LOSS_INVESTMENT.name, amount)

  // Both planes fall by exactly the booked kwota — brutto by the same number, NOT by 1,23×. That is
  // the whole difference between a strata and a rabat, and it is invisible in tryb netto.
  await expect
    .poll(async () => (await readSettlement(page, LOSS_INVESTMENT.id)).due[0], { timeout: 20_000 })
    .toBeCloseTo(before.due[0] - amount, 2)
  const after = await readSettlement(page, LOSS_INVESTMENT.id)
  expect(after.due[1]).toBeCloseTo(before.due[1] - amount, 2)

  // And the deduction is its own named step, not folded into „Wpłaty" — the client reads this table
  // top-down, so a strata hidden inside the wpłaty would misstate what was actually paid. It renders
  // negative (a subtracted step), hence the widening magnitude.
  expect(after.loss[0]).toBeCloseTo(after.loss[1], 2)
  expect(after.loss[0]).toBeCloseTo(before.loss[0] - amount, 2)
})

test('an investment with no strata prints no strata step', async ({ page }) => {
  await page.goto(`/inwestycje/${CLEAN_INVESTMENT.id}`)
  await openPanelView(page, 'Podsumowanie')
  const figures = await readSummaryFigures(page)

  // A 0 zł step is worse than no step: it invites the reader to look for a strata that isn't there.
  expect(figures['Pozostało do zapłaty'], 'the panel rendered no settlement at all').toBeTruthy()
  expect(figures['Strata']).toBeUndefined()
})
