import { test, expect, type Page } from '@playwright/test'
import { type FleetSeedT, seedFleet } from './support/seeds'
import { tableCell } from './support/table'
import { waitForHydration } from './support/wait'

// EX-716 — flota: what is left of the issue once the cheaper layers have taken their share.
//
// The deadline arithmetic, the ODOMETER exclusion and „no price" vs „0 zł" are unit-covered
// (`src/__tests__/lib/fleet/`); the four states of a deadline cell and the agreement between the
// „Razem" footer, the search box and the „Koszty" column are DOM-covered
// (`src/__tests__/components/fleet/`). One fact survives that split because it only exists once a
// real boundary is crossed: „Nie dotyczy (bezterminowo)" is ticked on the vehicle FORM, stored as a
// hidden json field on the vehicle, and read back on a DIFFERENT route through a tagged
// `unstable_cache` entry. Every one of those seams can swallow the tick without failing — the form
// can drop a field the schema does not carry, the action can write without revalidating, and the
// listing would go on serving „brak danych" from the cached dataset.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: FleetSeedT

test.beforeAll(async ({ browser }) => {
  seed = await seedFleet(browser)
})

const TECHNICAL_COLUMN = 'Przegląd techniczny'

/** The global listing narrowed to this run's two vehicles — every figure below is then theirs. */
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
  // Three route renders and a server action, each re-reading the whole fleet dataset.
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

  // The listing is a different route reading a tagged cache entry the form never touched directly —
  // so this assertion is about revalidation as much as about the stored field.
  await openFleet(page)
  await expect(await tableCell(page, seed.exempt.registration, TECHNICAL_COLUMN)).toContainText(
    'bezterminowo',
  )
})
