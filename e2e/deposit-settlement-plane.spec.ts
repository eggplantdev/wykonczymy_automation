import { test, expect, type Locator, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import {
  ensureSettlementMode,
  EXPENSE_REGISTER,
  openPanelView,
  pickComboOption,
  refreshReferenceData,
  runSeedScript,
  settleWrite,
  uniqueAmount,
  waitForHydration,
} from './helpers'

// EX-723 — a wpłata booked on the plane the investment does not settle on.
//
// The rule itself (`strandsDeposit`) is one comparison and is unit-tested. What no cheaper layer
// reaches is that the owner's answer to the dialog SURVIVES: „Zapisz mimo to" has to cross the
// confirm promise awaited inside `onSubmit`, the server action, the transfers validation hook and
// the write, and then come back out of a cached read as a row the Podsumowanie tones red. Every one
// of those is a separate boundary, and the failure mode they hide is the expensive one — a dialog
// that warns, a submit that silently drops the wpłata, and an owner who believes the money is
// booked. So this spec asserts the PERSISTED row after a reload, never the action's verdict.
//
// The inverse leg is here for the same reason: a przelew on an investment settled netto is off-plane
// too — it is flagged red — but it loses no money, so it must NOT stop to ask. Only a browser can
// show that those two predicates are still separate.
// Narrower than the project's 3000px default on purpose: nothing here reads a virtualised grid
// column, and headless Chrome composites in software — 4.2 Mpx of kosztorys per action is what makes
// this spec's clicks time out on a loaded machine.
test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1600, height: 1000 } })
// Each test here is two full route loads, a combo-heavy form, a confirm and a read-back — three
// times the work the 120 s default was sized for, and it does not fit whenever the machine is busy.
test.describe.configure({ timeout: 360_000 })

// One fresh investment per tryb, seeded rather than picked out of the dump: the wpłaty list read
// back below has to hold this run's rows and nobody else's, and the rozliczenie the whole spec turns
// on is only offered on a NON-EMPTY kosztorys — a dump investment that happens to carry no pozycje
// renders „Kosztorys jest pusty" and no Podsumowanie at all. „Odśwież dane" (`refreshReferenceData`)
// is what makes a seeded investment resolvable on `kosztorys_v2`, whose route reads `fetchReferenceData`.
type InvestmentT = { id: number; name: string }
let GROSS_INVESTMENT: InvestmentT
let NET_INVESTMENT: InvestmentT

test.beforeAll(async ({ browser }) => {
  const seedOne = (): InvestmentT => {
    const seed = runSeedScript<{ investment: number; investmentName: string }>(
      'seed:kosztorys-bands',
      'BANDS_SEED',
    )
    return { id: seed.investment, name: seed.investmentName }
  }
  GROSS_INVESTMENT = seedOne()
  NET_INVESTMENT = seedOne()
  await refreshReferenceData(browser)
})

async function openSummary(page: Page, investmentId: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  await openPanelView(page, 'Podsumowanie')
}

// The top-nav „Wpłata" dialog. Opened from the investment's own route, so the form seeds the
// investment from the URL — asserted rather than assumed, because a seed that silently failed would
// book the wpłata against no investment and the tryb would then never be consulted at all.
async function openDepositDialog(page: Page, investmentName: string): Promise<Locator> {
  const trigger = page.getByRole('button', { name: 'Wpłata' })
  await trigger.waitFor()
  await waitForHydration(trigger)
  await trigger.click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Nowa wpłata' })
  await dialog.waitFor()
  await expect(dialog.getByLabel('Inwestycja')).toContainText(investmentName)
  await pickComboOption(page, 'Kasa', EXPENSE_REGISTER.name)
  return dialog
}

type DepositRowT = { net: string; gross: string; form: string; flagged: boolean }

// The wpłaty list is a `SummaryTable` — a CSS grid whose cells are direct children, four tracks per
// row (date, netto, brutto, forma), the first four being the header. `text-destructive` is the whole
// of „red": `summary-grid.tsx` keeps one tone map and nothing under summary/ may paint around it.
async function readDepositRows(page: Page): Promise<DepositRowT[]> {
  const grid = page
    .locator('div[style*="grid-template-columns"]')
    .filter({ hasText: 'Forma wpłaty' })
    .first()
  // An investment with no wpłaty renders „Brak wpłat." and no grid at all, which is a reading this
  // spec asserts („Popraw" leaves none behind) — waiting for the grid there would spend the whole
  // budget proving the empty state is empty.
  const empty = page.getByText('Brak wpłat.')
  await expect(grid.or(empty).first()).toBeVisible()
  if (await empty.isVisible()) return []
  return grid.evaluate((node) => {
    const cells = Array.from(node.children) as HTMLElement[]
    const rows: DepositRowT[] = []
    for (let index = 4; index + 4 <= cells.length; index += 4) {
      rows.push({
        net: (cells[index + 1].textContent ?? '').trim(),
        gross: (cells[index + 2].textContent ?? '').trim(),
        form: (cells[index + 3].textContent ?? '').trim(),
        flagged: cells[index + 1].classList.contains('text-destructive'),
      })
    }
    return rows
  })
}

async function findDepositRow(page: Page, net: number): Promise<DepositRowT[]> {
  const rows = await readDepositRows(page)
  return rows.filter((row) => row.net === formatNet(net))
}

test('a cash deposit on a gross-settled investment is warned about, then persisted red when the owner insists', async ({
  page,
}) => {
  const amount = uniqueAmount()
  await ensureSettlementMode(page, GROSS_INVESTMENT.id, 'Brutto')

  const dialog = await openDepositDialog(page, GROSS_INVESTMENT.name)
  // „Gotówka netto" is the form's default method, so the plane is already the losing one — the tryb
  // is what changed, which is exactly the real-world shape of this mistake.
  await dialog.getByLabel('Kwota (PLN)').fill(amount.toFixed(2))
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click()

  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Ta wpłata nie policzy się w rozliczeniu')
  // Awaited to the action's response, not to the dialog closing: the submit is fire-and-forget over
  // an optimistic store, so `openSummary`'s navigation below would abort the write it reads back.
  await settleWrite(page, () => confirm.getByRole('button', { name: 'Zapisz mimo to' }).click())
  // The form dialog closes only on a successful action — the owner's „yes" reached the write.
  await expect(dialog).toBeHidden()

  // Read back off a fresh render, not off the optimistic list: a submit that resolved and wrote
  // nothing would look identical until the page is loaded again.
  await openSummary(page, GROSS_INVESTMENT.id)
  const matches = await findDepositRow(page, amount)
  expect(
    matches,
    `exactly one wpłata worth ${formatNet(amount)} — a collision would read as one`,
  ).toHaveLength(1)
  const [row] = matches
  // Gotówka has no brutto kwota at all, which is the whole reason it counts as zero here.
  expect(row.gross).toBe('×')
  expect(row.form).toBe('Gotówka')
  expect(row.flagged, 'the wpłata was booked but the list does not mark it as off-plane').toBe(true)

  await expect(
    page.getByRole('alert').filter({ hasText: 'ustaw rozliczenie mieszane' }),
  ).toBeVisible()
})

test('„Popraw" leaves no wpłata behind', async ({ page }) => {
  const amount = uniqueAmount()
  await ensureSettlementMode(page, GROSS_INVESTMENT.id, 'Brutto')

  const dialog = await openDepositDialog(page, GROSS_INVESTMENT.name)
  await dialog.getByLabel('Kwota (PLN)').fill(amount.toFixed(2))
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click()

  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Ta wpłata nie policzy się w rozliczeniu')
  await confirm.getByRole('button', { name: 'Popraw' }).click()
  // Declining returns to the form with the typed wpłata intact — it is a correction, not a discard.
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Kwota (PLN)')).toHaveValue(amount.toFixed(2))
  await page.keyboard.press('Escape')

  await openSummary(page, GROSS_INVESTMENT.id)
  expect(await findDepositRow(page, amount)).toHaveLength(0)
})

test('a transfer on a net-settled investment is flagged but never stops to ask', async ({
  page,
}) => {
  const gross = uniqueAmount()
  const net = Number((gross - 40).toFixed(2))
  await ensureSettlementMode(page, NET_INVESTMENT.id, 'Netto')

  const dialog = await openDepositDialog(page, NET_INVESTMENT.name)
  await dialog.getByLabel('Metoda płatności').click()
  await page.getByRole('option', { name: 'Przelew brutto', exact: true }).click()
  await dialog.getByLabel('Kwota brutto (PLN)').fill(gross.toFixed(2))
  // After the brutto, because typing it suggests a netto at the investment's stawka — the faktura's
  // own netto is what gets stored, so it is typed last and overwrites the suggestion.
  await dialog.getByLabel('Kwota netto z faktury (PLN)').fill(net.toFixed(2))
  await settleWrite(page, () => dialog.getByRole('button', { name: 'Dodaj', exact: true }).click())

  // The form dialog cannot close while a confirm is unanswered, so its closing IS the proof that
  // none was raised — and it is a wait, not a snapshot, so it cannot pass by looking too early.
  await expect(dialog).toBeHidden()

  await openSummary(page, NET_INVESTMENT.id)
  const matches = await findDepositRow(page, net)
  expect(matches).toHaveLength(1)
  const [row] = matches
  expect(row.gross).toBe(formatNet(gross))
  expect(row.form).toBe('Przelew')
  // Still off-plane — the tryb is wrong here too. The two predicates are deliberately different
  // widths: this one is marked, only the money-losing direction is asked about.
  expect(row.flagged).toBe(true)
})
