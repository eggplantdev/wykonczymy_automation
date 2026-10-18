import { test, expect } from '@playwright/test'
import { openInvestmentExpenseForm, saveExpenseForm } from './drivers/expenses'
import { PHONE_VIEWPORT } from './support/viewport'
import { EXPENSE_REGISTER } from '@/scripts/e2e-dump-rows'

test.use({ viewport: PHONE_VIEWPORT })

test('na telefonie wydatek dodaje się przez pełnoekranowy arkusz i ląduje w kasie', async ({
  page,
}) => {
  const description = `E2E-mobile-${Date.now()}`
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openInvestmentExpenseForm(page, '2.34', description)

  const sheet = page.getByRole('dialog').filter({ hasText: 'Nowy wydatek' })
  expect(await sheet.boundingBox()).toMatchObject({ y: 0, ...PHONE_VIEWPORT })

  await saveExpenseForm(page)
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()
})
