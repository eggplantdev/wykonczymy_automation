import { test, expect } from '@playwright/test'
import { bare } from './support/money'
import { waitForHydration } from './support/wait'
import {
  createInvestmentExpense,
  EXPENSE_INVESTMENT,
  EXPENSE_REGISTER,
  openInvestmentExpenseForm,
  pickExpenseType,
  submitExpenseForm,
} from './drivers/expenses'
import { openPanelView } from './drivers/settlement'
import { readRegisterBalance, readRegisterBalanceStable } from './drivers/transfers'

test.use({ storageState: 'e2e/.auth/user.json' })

const GROSS = 1230.37
const NET = 1000.3

test('the netto pair is gated by type and refused when netto exceeds brutto', async ({ page }) => {
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openInvestmentExpenseForm(page, GROSS.toFixed(2), `E2E netto gate ${Date.now()}`, '9999')

  await submitExpenseForm(page)
  await expect(page.getByText('Kwota netto nie może przekraczać kwoty brutto')).toBeVisible()
  await expect(page.getByText('Nowy wydatek').first()).toBeVisible()

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

  await expect.poll(() => readRegisterBalance(page)).toBeCloseTo(before - GROSS, 2)

  const row = page.locator('table tbody tr').filter({ hasText: description }).first()
  await expect(row).toBeVisible()
  const amountText = bare((await row.textContent()) ?? '')
  expect(amountText).toContain(bare('1 230,37 zł'))
  expect(amountText).toContain(bare('netto 1 000,30 zł'))

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
