import { expect, type Page } from '@playwright/test'
import { pickComboOption } from '../support/ui'
import { nudgeUntil, RETRY_STEP_MS, waitForHydration } from '../support/wait'

// Real long-standing entities the expense specs select. They exist in the standard Neon→local
// dump; `pnpm db:import:test` restores them into the 5435 test DB. If a future dump drops them,
// update here.
export const EXPENSE_REGISTER = { id: 5, name: 'Kasa główna Bartek' }
export const EXPENSE_INVESTMENT = 'Plac Hallera 6'
export const EXPENSE_CATEGORY = 'Materiały budowlane'

// „Typ wydatku" is a Radix Select, so it opens a listbox rather than accepting `selectOption`.
export async function pickExpenseType(page: Page, label: string): Promise<void> {
  await page.getByLabel('Typ wydatku', { exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

// The global-nav „Wydatek" dialog, opened and nothing more — for a caller that only wants to read
// one of its pickers rather than book anything.
export async function openExpenseDialog(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  const title = page.getByText('Nowy wydatek').first()
  // A second „Wydatek" in the same test — one booking, then the next — clicks the trigger while the
  // dialog that just closed is still tearing down (transfer-sum-tile died exactly there).
  await nudgeUntil(
    async () => {
      if (!(await title.isVisible())) await trigger.click({ timeout: RETRY_STEP_MS })
    },
    () => expect(title).toBeVisible({ timeout: RETRY_STEP_MS }),
  )
}

// Open the global-nav "Wydatek" dialog and fill one line item against the shared
// investment/register/category, WITHOUT submitting — for a caller that wants to assert the form
// itself (a gated field, an inline error) before deciding whether to save.
export async function openInvestmentExpenseForm(
  page: Page,
  amount: string,
  description: string,
  netAmount?: string,
): Promise<void> {
  await openExpenseDialog(page)
  // The netto type has to be picked BEFORE the rest: switching type blanks the top-level fields.
  if (netAmount !== undefined) await pickExpenseType(page, 'Wydatek inwestycyjny netto')
  await pickComboOption(page, 'Inwestycja', EXPENSE_INVESTMENT)
  await pickComboOption(page, 'Kasa', EXPENSE_REGISTER.name)
  // The row's amount label is „Kwota" alone and „Brutto" once a netto figure sits beside it.
  await page
    .getByLabel(netAmount === undefined ? 'Kwota' : 'Brutto')
    .first()
    .fill(amount)
  if (netAmount !== undefined) await page.getByLabel('Netto').first().fill(netAmount)
  await page.locator('[id="lineItems[0].description"]').fill(description)
  await pickComboOption(page, 'Typ wydatku inwestycyjnego', EXPENSE_CATEGORY)
  // Only the netto type stores how the faktura was paid (`carriesPaymentMethod`), and the form
  // deliberately offers no default — „Gotówka" preselected would make the column mean „gotówka albo
  // nikt nie pytał". So the netto branch has to answer it, or the submit is refused and the dialog
  // simply stays open. Picked last: switching type blanks the top-level fields, and this is one.
  if (netAmount !== undefined) {
    await page.getByLabel('Metoda płatności', { exact: true }).click()
    await page.getByRole('option', { name: 'Gotówka', exact: true }).click()
  }
}

// The same dialog, submitted. Resolves once it has closed — which only happens on a successful
// write, so the close IS the proof the action was accepted.
export async function createInvestmentExpense(
  page: Page,
  amount: string,
  description: string,
  netAmount?: string,
): Promise<void> {
  await openInvestmentExpenseForm(page, amount, description, netAmount)
  await submitExpenseForm(page)
  await waitForExpenseDialogToClose(page)
}

// The dialog closes only on a successful action, so it staying open IS the failure — but „element is
// still visible" names nothing, and the dialog is holding the answer on screen the whole time. Read
// the field errors and the toast out of it and fail with those instead.
async function waitForExpenseDialogToClose(page: Page): Promise<void> {
  const title = page.getByText('Nowy wydatek').first()
  try {
    await title.waitFor({ state: 'hidden' })
  } catch (cause) {
    const complaints = await page
      .getByRole('dialog')
      .locator('[data-slot=field-error], .text-destructive')
      .allTextContents()
    const toast = await page.locator('.Toastify__toast').allTextContents()
    const said = [...complaints, ...toast].map((text) => text.trim()).filter(Boolean)
    throw new Error(
      said.length > 0
        ? `„Nowy wydatek" refused the submit: ${said.join(' | ')}`
        : '„Nowy wydatek" stayed open and said nothing — the action failed silently',
      { cause },
    )
  }
}

// `exact`, because „Zapisz jako domyślną kasę" sits in the same dialog and only stores a preference.
export async function submitExpenseForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
}

// Open the shared expense investment by clicking its listing row — the listing navigates by
// `getRowHref`, so this also resolves the id a spec then reads pages by, without hard-coding one a
// future dump could renumber.
export async function openExpenseInvestment(page: Page): Promise<number> {
  await page.goto('/inwestycje')
  const row = page
    .locator('table tbody tr')
    .filter({ has: page.getByText(EXPENSE_INVESTMENT, { exact: true }) })
    .first()
  await row.waitFor()
  await waitForHydration(row)
  await row.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  const id = Number(new URL(page.url()).pathname.split('/').pop())
  expect(Number.isInteger(id), `„${EXPENSE_INVESTMENT}" row did not open an investment page`).toBe(
    true,
  )
  return id
}
