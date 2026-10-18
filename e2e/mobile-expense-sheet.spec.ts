import { test, expect } from '@playwright/test'
import { openInvestmentExpenseForm, submitExpenseForm } from './drivers/expenses'
import { EXPENSE_REGISTER } from '@/scripts/e2e-dump-rows'

const VIEWPORT = { width: 390, height: 844 }
test.use({ viewport: VIEWPORT })

test('na telefonie wydatek dodaje się przez pełnoekranowy arkusz i ląduje w kasie', async ({
  page,
}) => {
  const description = `E2E-mobile-${Date.now()}`
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openInvestmentExpenseForm(page, '2.34', description)

  const sheet = page.getByRole('dialog').filter({ hasText: 'Nowy wydatek' })
  const box = await sheet.boundingBox()
  expect(box, 'the sheet has no box').not.toBeNull()
  expect(box?.y).toBe(0)
  expect(box?.height).toBe(VIEWPORT.height)
  expect(box?.width).toBe(VIEWPORT.width)

  await submitExpenseForm(page)
  await page.getByRole('button', { name: 'Zapisz bez faktury' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()
})
