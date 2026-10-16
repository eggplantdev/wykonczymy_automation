import { test, expect, type Page } from '@playwright/test'
import { type FleetSeedT, seedFleet } from './support/seeds'
import { tableCell } from './support/table'
import { waitForHydration } from './support/wait'

test.use({ storageState: 'e2e/.auth/user.json' })

let seed: FleetSeedT

test.beforeAll(async ({ browser }) => {
  seed = await seedFleet(browser)
})

const TECHNICAL_COLUMN = 'Przegląd techniczny'

async function openFleet(page: Page): Promise<void> {
  await page.goto('/flota')
  const search = page.getByPlaceholder('Szukaj...')
  await waitForHydration(search)
  await search.fill(seed.prefix)
  await expect(page.locator('table tbody tr')).toHaveCount(2)
}

test('„Nie dotyczy (bezterminowo)" z formularza pojazdu dociera do kolumny na liście', async ({
  page,
}) => {
  test.slow()

  // „brak danych" is the known-positive: this car has no przegląd techniczny on file, so anything
  // the cell says later is the exemption talking and not an event that was always there.
  await openFleet(page)
  await expect(await tableCell(page, seed.exempt.registration, TECHNICAL_COLUMN)).toContainText(
    'brak danych',
  )

  await page.goto(`/flota/${seed.exempt.id}`)
  const edit = page.getByRole('button', { name: 'Edytuj pojazd' })
  await waitForHydration(edit)
  await edit.click()
  await page.getByRole('checkbox', { name: TECHNICAL_COLUMN }).click()
  await page.getByRole('button', { name: 'Zapisz' }).click()
  await expect(page.getByText('Pojazd zaktualizowany')).toBeVisible()

  await openFleet(page)
  await expect(await tableCell(page, seed.exempt.registration, TECHNICAL_COLUMN)).toContainText(
    'bezterminowo',
  )
})
