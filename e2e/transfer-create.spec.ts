import { test, expect } from '@playwright/test'
import { createInvestmentExpense } from './drivers/expenses'
import { EXPENSE_REGISTER } from '@/scripts/e2e-dump-rows'
import { readRegisterBalance, readRegisterBalanceStable } from './drivers/transfers'

test('creating an expense updates the source register balance and adds a row', async ({ page }) => {
  const registerUrl = `/kasa/${EXPENSE_REGISTER.id}`
  await page.goto(registerUrl)
  const before = await readRegisterBalanceStable(page)

  const amount = '3.21'
  const description = `E2E-create-${Date.now()}`
  await createInvestmentExpense(page, amount, description)

  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()
  await expect.poll(() => readRegisterBalance(page)).toBeCloseTo(before - Number(amount), 2)
})
