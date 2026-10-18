import { test, expect } from '@playwright/test'
import { readSeed } from './support/seeds'
import { waitForHydration } from './support/wait'

test('a manager books a worker zgłoszenie from its photo and stored read onto his kasa', async ({
  page,
}) => {
  const draft = readSeed('expenseDraft')
  await page.goto('/zgloszenia-wydatkow')

  const queue = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Wydatki do sprawdzenia' }) })
  const verify = queue
    .getByRole('row')
    .filter({ hasText: draft.note })
    .getByRole('button', { name: 'Zweryfikuj' })
  await waitForHydration(verify)
  await verify.click()

  const dialog = page.getByRole('dialog').filter({ hasText: draft.workerName })
  await expect(dialog.getByLabel('Opis')).toHaveValue(draft.description)
  await expect(dialog.getByRole('button', { name: /^Podgląd faktury: paragon-a/ })).toBeVisible()
  await expect(dialog.getByText('Nie udało się pobrać zdjęć')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Przyjmij', exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(queue.getByRole('row').filter({ hasText: draft.note })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: draft.note })).toContainText('przyjęty')

  await page.goto(`/kasa/${draft.registerId}`)
  await expect(page.getByRole('row').filter({ hasText: draft.description })).toContainText('87,65')
})
