import { test, expect } from '@playwright/test'
import { createInvestmentExpense, readSaldo, readSaldoStable, EXPENSE_REGISTER } from './helpers'

test.use({ storageState: 'e2e/.auth/user.json' })

// Exercises the real client→server-action→DB→revalidate→refresh boundary the unit suite mocks:
// submitting the expense form must surface the new row AND an updated saldo on the same page,
// with no manual reload. Asserts rendered state, never the action's return value.
test('creating an expense updates the source register saldo and adds a row', async ({ page }) => {
  const registerUrl = `/kasa/${EXPENSE_REGISTER.id}`
  await page.goto(registerUrl)
  const before = await readSaldoStable(page)

  const amount = '3.21'
  const description = `E2E-create-${Date.now()}`
  await createInvestmentExpense(page, amount, description)

  // The new row appears (revalidate + router.refresh surfaced it) and the saldo dropped by the
  // expense amount — both without a page reload.
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()
  await expect.poll(() => readSaldo(page)).toBeCloseTo(before - Number(amount), 2)
})
