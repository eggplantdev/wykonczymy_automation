import { test, expect } from '@playwright/test'
import { createInvestmentExpense, EXPENSE_REGISTER } from './drivers/expenses'
import { readRegisterBalance, readRegisterBalanceStable } from './drivers/transfers'

test.use({ storageState: 'e2e/.auth/user.json' })

test('cancelling an expense reverts the balance and hides the row, gated by reason length', async ({
  page,
}) => {
  const registerUrl = `/kasa/${EXPENSE_REGISTER.id}`
  await page.goto(registerUrl)
  const before = await readRegisterBalanceStable(page)

  const description = `E2E-cancel-${Date.now()}`
  await createInvestmentExpense(page, '4.44', description)
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()

  const row = page.getByRole('row').filter({ hasText: description })
  await row.getByRole('button', { name: 'Anuluj transakcję' }).first().click()

  await expect(page.getByText('Anulowanie transakcji')).toBeVisible()
  const confirm = page.getByRole('button', { name: 'Tak, anuluj' })
  const reason = page.getByLabel('Powód anulowania (wymagany)')

  await expect(confirm).toBeDisabled()
  await reason.fill('ab')
  await expect(confirm).toBeDisabled() // below the 3-char minimum
  await reason.fill('anulowanie testu e2e')
  await expect(confirm).toBeEnabled()

  await confirm.click()
  await expect(page.getByText('Anulowanie transakcji')).toBeHidden()

  await expect(page.getByRole('cell', { name: description })).toHaveCount(0)
  await expect.poll(() => readRegisterBalance(page)).toBeCloseTo(before, 2)
})
