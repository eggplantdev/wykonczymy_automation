import { test, expect } from '@playwright/test'
import { createInvestmentExpense, EXPENSE_REGISTER } from './drivers/expenses'
import { readRegisterBalance, readRegisterBalanceStable } from './drivers/transfers'

test.use({ storageState: 'e2e/.auth/user.json' })

// The cancel flow is a two-write audit operation (mark original cancelled + insert a
// CANCELLATION row) whose balance effect is reversed by a Payload hook. This asserts the
// user-facing result: the reason min-length gates the confirm, and after cancelling the balance
// returns to its pre-create value and the cancelled row leaves the default (non-cancelled) view.
// The CANCELLATION audit row itself is filtered out of the register dataset + virtualized away,
// so it isn't asserted here; the two-write correctness is covered by the unit suite.
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

  await expect(confirm).toBeDisabled() // empty reason
  await reason.fill('ab')
  await expect(confirm).toBeDisabled() // below the 3-char minimum
  await reason.fill('anulowanie testu e2e')
  await expect(confirm).toBeEnabled()

  await confirm.click()
  await expect(page.getByText('Anulowanie transakcji')).toBeHidden()

  // Saldo returns to the pre-create value (the hook reversed the cancelled expense) and the
  // cancelled row is gone from the default view.
  await expect(page.getByRole('cell', { name: description })).toHaveCount(0)
  await expect.poll(() => readRegisterBalance(page)).toBeCloseTo(before, 2)
})
