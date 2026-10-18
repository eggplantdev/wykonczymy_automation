import { test, expect, type Locator, type Page } from '@playwright/test'
import { INVESTMENT_STATUS_LABELS } from '@/lib/constants/investment-status'
import { readListingCell } from './support/table'
import { waitForHydration } from './support/wait'
import { openExpenseDialog } from './drivers/expenses'
import { EXPENSE_INVESTMENT } from '@/scripts/e2e-dump-rows'

const STATUS_COLUMN = 'Status'

// Fresh on every run: the test DB is never reset, so a fixed name would make the second run assert
// against the investment the first one already promoted.
const PROSPECT = `Prospekt E2E ${Date.now()}`

const STATUS_FILTER_KEY = 'table-status-filter:investments'

// The „X / Y" counter counts the rows on show, so X is the active count only with „Status" narrowed to
// Aktywna — dropped again after the read, or the prospekt row would stay filtered out of the listing.
async function readActiveCount(page: Page): Promise<number> {
  await page.goto('/inwestycje')
  await page.evaluate((key) => localStorage.setItem(key, '{"active":true}'), STATUS_FILTER_KEY)
  await page.reload()
  // The server renders the default statuses, Planowana among them; the stored pick applies only
  // after hydration, so a counter read before it would count the prospekt as active.
  await expect(page.getByTitle('Filtr statusu')).toHaveText('Status (1)')
  const counter = page.getByText(/^Widoczne inwestycje \d+ \/ \d+$/)
  const shown = Number(/(\d+) \//.exec((await counter.textContent()) ?? '')?.[1])
  await page.evaluate((key) => localStorage.removeItem(key), STATUS_FILTER_KEY)
  return shown
}

// Every call also checks a known-bookable investment is in the same open list: without that,
// „the prospekt is not offered" would pass just as well on a picker that rendered nothing at all.
async function investmentIsOffered(page: Page, name: string): Promise<boolean> {
  await page.goto('/')
  await openExpenseDialog(page)
  await page.getByLabel('Inwestycja').click()
  await expect(page.getByRole('option', { name: EXPENSE_INVESTMENT, exact: true })).toHaveCount(1)
  const count = await page.getByRole('option', { name, exact: true }).count()
  await page.keyboard.press('Escape')
  return count > 0
}

// The status select has no label, so it is found as the form's first field.
async function pickStatus(page: Page, dialog: Locator, label: string): Promise<void> {
  await dialog.getByRole('combobox').first().click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test('prospekt jest widoczny na liście, ale nie liczy się jako aktywny — dopóki go nie promujemy', async ({
  page,
}) => {
  test.slow()

  const activeBefore = await readActiveCount(page)

  const add = page.getByRole('button', { name: 'Dodaj', exact: true }).first()
  await waitForHydration(add)
  await add.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa').fill(PROSPECT)
  await pickStatus(page, dialog, INVESTMENT_STATUS_LABELS.planowana.pl)
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })

  await expect(await readListingCell(page, PROSPECT, STATUS_COLUMN)).toHaveText(
    INVESTMENT_STATUS_LABELS.planowana.pl,
  )
  expect(await readActiveCount(page), 'prospekt doliczony do aktywnych').toBe(activeBefore)
  // Owner ruling 2026-10-15: money is booked on planned work, so Planowana is offered for booking.
  expect(await investmentIsOffered(page, PROSPECT), 'prospekt poza pickerem wydatku').toBe(true)

  // From the investment's own page rather than the listing row: the row is itself a link, so the
  // edit there would be a click inside a navigating element.
  const statusCell = await readListingCell(page, PROSPECT, STATUS_COLUMN)
  await statusCell.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  await page.getByRole('button', { name: 'Edytuj inwestycję' }).click()
  const editDialog = page.getByRole('dialog')
  await pickStatus(page, editDialog, INVESTMENT_STATUS_LABELS.active.pl)
  await editDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await editDialog.waitFor({ state: 'hidden' })

  await page.reload()
  await expect(
    page.getByText(INVESTMENT_STATUS_LABELS.active.pl, { exact: true }).first(),
  ).toBeVisible()

  await expect(await readListingCell(page, PROSPECT, STATUS_COLUMN)).toHaveText(
    INVESTMENT_STATUS_LABELS.active.pl,
  )
  expect(await readActiveCount(page), 'promocja nie podniosła licznika aktywnych').toBe(
    activeBefore + 1,
  )
  expect(await investmentIsOffered(page, PROSPECT), 'promowana inwestycja poza pickerem').toBe(true)
})
