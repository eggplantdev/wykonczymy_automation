import { test, expect, type Locator, type Page } from '@playwright/test'
import { STATUS_LABELS } from '@/components/investments/investment-status-badge'
import {
  EXPENSE_INVESTMENT,
  openExpenseDialog,
  readListingCell,
  refreshReferenceData,
  waitForHydration,
} from './helpers'

// EX-528 — what „Planowana" actually costs an investment, and what promoting it gives back.
//
// The issue proposed five assertions; three of them have a cheaper guard today and are deliberately
// not repeated here. The status-filter views are exactly what `src/__tests__/use-status-filter.test.ts`
// already asserts (default = active + planowana, „Planowane" isolates, „Wszystkie" shows all), the
// badge being read-only asserts a non-feature (it is a `<span>`), and a fresh investment's zero
// figures are a property of having no transfers, not of its status.
//
// What is left is browser-only, and it is one fact read through two surfaces that must not disagree:
// a prospekt is NOT an aktywna inwestycja. It is listed and openable, but the „N aktywnych" counter
// skips it and the „Inwestycja" picker in the wydatek dialog does not offer it — because money must
// not land on a deal nobody has agreed to yet. Both readings come off the same `fetchReferenceData`
// cache (`active: status === 'active'`), and promoting the prospekt has to flip both at once — which
// makes this a test of the write AND of the revalidation the server action owes it: form → server
// action → Postgres → cache tag → two re-renders. Nothing below the browser holds that chain.
test.use({ storageState: 'e2e/.auth/user.json' })

const STATUS_COLUMN = 'Status'

// Earlier specs seed investments straight into Postgres, which no cache tag hears about, so the
// „N aktywnych" counter can still be quoting a number from before them. The baseline below is a
// DIFFERENCE, so a stale first reading and a fresh second one would read as „prospekt doliczony do
// aktywnych" — a bug in the seeds' wake rather than in the status.
test.beforeAll(async ({ browser }) => {
  await refreshReferenceData(browser)
})

// Fresh on every run: the test DB is never reset, so a fixed name would make the second run assert
// against the investment the first one already promoted.
const PROSPECT = `Prospekt E2E ${Date.now()}`

async function readActiveCount(page: Page): Promise<number> {
  await page.goto('/inwestycje')
  const description = page.getByText(/\d+ aktywnych/)
  await description.waitFor()
  return Number(/(\d+) aktywnych/.exec((await description.textContent()) ?? '')?.[1])
}

// The wydatek dialog's „Inwestycja" picker, asked whether it offers one name. Every call also checks
// a known-bookable investment is in the same open list: without that, „the prospekt is not offered"
// would pass just as well on a picker that rendered nothing at all.
async function investmentIsOffered(page: Page, name: string): Promise<boolean> {
  await page.goto('/')
  await openExpenseDialog(page)
  await page.getByLabel('Inwestycja').click()
  await expect(page.getByRole('option', { name: EXPENSE_INVESTMENT, exact: true })).toHaveCount(1)
  const count = await page.getByRole('option', { name, exact: true }).count()
  await page.keyboard.press('Escape')
  return count > 0
}

// Scoped to the open dialog and exact: the listing behind it carries a „Filtr statusu" button,
// which a loose label match would fold in. The options themselves are portalled out of the dialog.
async function pickStatus(page: Page, dialog: Locator, label: string): Promise<void> {
  await dialog.getByLabel('Status', { exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test('prospekt jest widoczny na liście, ale nie liczy się jako aktywny — dopóki go nie promujemy', async ({
  page,
}) => {
  // Two dialogs, four full listing renders and a detail page, each re-fetching the reference data.
  test.slow()

  const activeBefore = await readActiveCount(page)

  const add = page.getByRole('button', { name: 'Dodaj', exact: true }).first()
  await waitForHydration(add)
  await add.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nazwa').fill(PROSPECT)
  await pickStatus(page, dialog, STATUS_LABELS.planowana)
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click()
  // The dialog closes only on a successful write, so its disappearance IS the proof the action was
  // accepted — there is no toast to race with.
  await dialog.waitFor({ state: 'hidden' })

  await expect(await readListingCell(page, PROSPECT, STATUS_COLUMN)).toHaveText(
    STATUS_LABELS.planowana,
  )
  expect(await readActiveCount(page), 'prospekt doliczony do aktywnych').toBe(activeBefore)
  expect(await investmentIsOffered(page, PROSPECT), 'prospekt w pickerze wydatku').toBe(false)

  // --- promocja: Edytuj → Aktywna ---
  // From the investment's own page rather than the listing row: the row is itself a link, so the
  // edit there would be a click inside a navigating element.
  const statusCell = await readListingCell(page, PROSPECT, STATUS_COLUMN)
  await statusCell.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  await page.getByRole('button', { name: 'Edytuj inwestycję' }).click()
  const editDialog = page.getByRole('dialog')
  await pickStatus(page, editDialog, STATUS_LABELS.active)
  await editDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await editDialog.waitFor({ state: 'hidden' })

  // The detail page reads the status straight from the same cache the listing does, so it answers
  // first — and it answers about Postgres, not about the form's own optimistic state.
  await page.reload()
  await expect(page.getByText(STATUS_LABELS.active, { exact: true }).first()).toBeVisible()

  await expect(await readListingCell(page, PROSPECT, STATUS_COLUMN)).toHaveText(
    STATUS_LABELS.active,
  )
  expect(await readActiveCount(page), 'promocja nie podniosła licznika aktywnych').toBe(
    activeBefore + 1,
  )
  expect(await investmentIsOffered(page, PROSPECT), 'promowana inwestycja poza pickerem').toBe(true)
})
