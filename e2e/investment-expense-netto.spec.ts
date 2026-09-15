import { test, expect } from '@playwright/test'
import {
  bare,
  createInvestmentExpense,
  EXPENSE_INVESTMENT,
  EXPENSE_REGISTER,
  openInvestmentExpenseForm,
  openPanelView,
  pickExpenseType,
  readRegisterBalance,
  readRegisterBalanceStable,
  submitExpenseForm,
  waitForHydration,
} from './helpers'

// EX-576 — „Wydatek inwestycyjny netto" is the one expense type whose two figures part company: the
// kasa loses GROSS (that is what left the register and what reconciles there), while the investor is
// billed NET. The arithmetic and the bucketing are unit-covered; what only the browser can answer is
// whether the form hands the pair over intact and whether both figures then render on their own side.
//
// Immutability of `amount`/`netAmount`/`type` (risk 2 of the issue) is a Payload access rule, not a
// browser fact — `access: { update: () => false }` is asserted where it lives, not by clicking at it.
test.use({ storageState: 'e2e/.auth/user.json' })

const GROSS = 1230.37
const NET = 1000.3

test('the netto pair is gated by type and refused when netto exceeds brutto', async ({ page }) => {
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openInvestmentExpenseForm(page, GROSS.toFixed(2), `E2E netto gate ${Date.now()}`, '9999')

  // Netto above brutto is the one combination the type can produce and the ledger cannot hold: the
  // register would be short of what the investor was billed for.
  await submitExpenseForm(page)
  await expect(page.getByText('Kwota netto nie może przekraczać kwoty brutto')).toBeVisible()
  // The dialog is still open — the error blocked the write rather than annotating one that landed.
  await expect(page.getByText('Nowy wydatek').first()).toBeVisible()

  // Back on the brutto type there is no second figure to give, so the input is gone and the one that
  // remains is „Kwota" again — the label is what tells the user which plane they are typing on.
  await pickExpenseType(page, 'Wydatek inwestycyjny')
  await expect(page.getByLabel('Netto')).toHaveCount(0)
  await expect(page.getByLabel('Kwota').first()).toBeVisible()
})

test('a netto expense takes brutto out of the kasa and shows netto beneath it', async ({
  page,
}) => {
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  const before = await readRegisterBalanceStable(page)

  const description = `E2E wydatek netto ${Date.now()}`
  await createInvestmentExpense(page, GROSS.toFixed(2), description, NET.toFixed(2))

  // The whole point of the type: the kasa moves by GROSS. A balance that fell by netto would look
  // like a number rather than like a bug, which is why it is pinned to the grosz.
  await expect.poll(() => readRegisterBalance(page)).toBeCloseTo(before - GROSS, 2)

  // Both figures on one row, brutto first — the column is summed against the kasa balance, so the
  // amount that left the register has to be the primary one.
  const row = page.locator('table tbody tr').filter({ hasText: description }).first()
  await expect(row).toBeVisible()
  const amountText = bare((await row.textContent()) ?? '')
  expect(amountText).toContain(bare('1 230,37 zł'))
  expect(amountText).toContain(bare('netto 1 000,30 zł'))

  // And the investor's side sees it: the booking lands on the panel's „Materiały" tab, which reads
  // the netto plane. A missed bucket here is how the figure and the list stop agreeing.
  await page.goto('/inwestycje')
  const investmentRow = page
    .locator('table tbody tr')
    .filter({ has: page.getByText(EXPENSE_INVESTMENT, { exact: true }) })
    .first()
  await investmentRow.waitFor()
  await waitForHydration(investmentRow)
  await investmentRow.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  await openPanelView(page, 'Materiały')
  await expect(page.getByText(description).first()).toBeVisible({ timeout: 20_000 })
})
