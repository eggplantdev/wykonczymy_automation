import { test, expect, type Page } from '@playwright/test'
import { isInvestmentOffered } from './drivers/expenses'
import { expectNotFound } from './support/not-found'
import { readSeed } from './support/seeds'
import { waitForHydration } from './support/wait'

const listingRow = (page: Page, name: string) =>
  page.locator('table tbody tr').filter({ has: page.getByText(name, { exact: true }) })

const trashSection = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Inwestycje' }) })

async function trashFromListing(page: Page, name: string): Promise<void> {
  const trash = listingRow(page, name).getByRole('button', { name: 'Usuń inwestycję' })
  await waitForHydration(trash)
  await trash.click()
  await page.getByRole('button', { name: 'Przenieś do kosza' }).click()
  await expect(listingRow(page, name)).toHaveCount(0)
}

async function openInTrash(page: Page, name: string): Promise<void> {
  await page.goto('/kosz')
  await expect(trashSection(page).getByText(name, { exact: true })).toBeVisible()
}

test('an investment goes to Kosz, comes back, and is deleted forever only under its typed name', async ({
  page,
}) => {
  test.slow()
  const investment = readSeed('trash')

  await page.goto('/inwestycje')
  await trashFromListing(page, investment.name)
  expect(await isInvestmentOffered(page, investment.name), 'still offered after the trash').toBe(
    false,
  )

  await openInTrash(page, investment.name)
  const restore = page.getByRole('button', { name: `Przywróć „${investment.name}"` })
  await waitForHydration(restore)
  await restore.click()
  await expect(trashSection(page).getByText(investment.name, { exact: true })).toHaveCount(0)
  await page.goto('/inwestycje')
  await expect(listingRow(page, investment.name)).toHaveCount(1)

  await trashFromListing(page, investment.name)
  await openInTrash(page, investment.name)
  const deleteForever = page.getByRole('button', { name: `Usuń „${investment.name}" na zawsze` })
  await waitForHydration(deleteForever)
  await deleteForever.click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Usuń na zawsze' })
  await dialog.getByLabel('Nazwa inwestycji').fill(`${investment.name} x`)
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Nazwa inwestycji').fill(investment.name)
  await confirm.click()
  await expect(dialog).toBeHidden()
  await expect(trashSection(page).getByText(investment.name, { exact: true })).toHaveCount(0)

  await page.goto(`/inwestycje/${investment.id}`)
  await expectNotFound(page)
})
