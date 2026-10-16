import { expect, type Page } from '@playwright/test'
import { pickComboOption } from './combo'
import { nudgeUntil, RETRY_STEP_MS, waitForHydration } from '../support/wait'

export const EXPENSE_REGISTER = { id: 5, name: 'Kasa główna Bartek' }
export const EXPENSE_INVESTMENT = 'Plac Hallera 6'
export const EXPENSE_CATEGORY = 'Materiały budowlane'

// „Typ wydatku" is a Radix Select, so it opens a listbox rather than accepting `selectOption`.
export async function pickExpenseType(page: Page, label: string): Promise<void> {
  await page.getByLabel('Typ wydatku', { exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

export async function openExpenseDialog(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  const title = page.getByText('Nowy wydatek').first()
  // A second „Wydatek" in the same test clicks the trigger while the dialog that just closed is
  // still tearing down.
  await nudgeUntil(
    async () => {
      if (!(await title.isVisible())) await trigger.click({ timeout: RETRY_STEP_MS })
    },
    () => expect(title).toBeVisible({ timeout: RETRY_STEP_MS }),
  )
}

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
  await page
    .getByLabel(netAmount === undefined ? 'Kwota' : 'Brutto')
    .first()
    .fill(amount)
  if (netAmount !== undefined) await page.getByLabel('Netto').first().fill(netAmount)
  await page.locator('[id="lineItems[0].description"]').fill(description)
  await pickComboOption(page, 'Typ wydatku inwestycyjnego', EXPENSE_CATEGORY)
  // The form deliberately offers no default, so the netto branch has to answer it, or the submit is
  // refused and the dialog simply stays open.
  if (netAmount !== undefined) {
    await page.getByLabel('Metoda płatności', { exact: true }).click()
    await page.getByRole('option', { name: 'Gotówka', exact: true }).click()
  }
}

export async function createInvestmentExpense(
  page: Page,
  amount: string,
  description: string,
  netAmount?: string,
): Promise<void> {
  await openInvestmentExpenseForm(page, amount, description, netAmount)
  await submitExpenseForm(page)
  const saveWithoutInvoice = page.getByRole('button', { name: 'Zapisz bez faktury' })
  const refusal = page.getByRole('dialog').locator('[data-slot=field-error]')
  await expect(saveWithoutInvoice.or(refusal).first()).toBeVisible()
  if (await saveWithoutInvoice.isVisible()) await saveWithoutInvoice.click()
  await waitForExpenseDialogToClose(page)
}

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
