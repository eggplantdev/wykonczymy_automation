import { test, expect, type Page } from '@playwright/test'
import { expectMoney, seedFleet, tableCell, waitForHydration, type FleetSeedT } from './helpers'

// EX-716 — flota: what is left of the issue once the cheaper layers have taken their share.
//
// The deadline arithmetic, the cost window's boundary days, the ODOMETER exclusion and „no price" vs
// „0 zł" are unit-covered (`src/__tests__/lib/fleet/`); the four states of a deadline cell and the
// agreement between the „Razem" footer, the search box and the „Koszty" column are DOM-covered
// (`src/__tests__/components/fleet/`). Two facts survive that split because they only exist once a
// real boundary is crossed:
//
//   • „Nie dotyczy (bezterminowo)" is ticked on the vehicle FORM, stored as a hidden json field on
//     the vehicle, and read back on a DIFFERENT route through a tagged `unstable_cache` entry. Every
//     one of those seams can swallow the tick without failing: the form can drop a field the schema
//     does not carry, the action can write without revalidating, and the listing would go on serving
//     „brak danych" from the cached dataset.
//   • The „?from=&to=" window is parsed on the server and threaded past the cache key on purpose
//     (`fetchFleetOverview`), so the window narrowing the money is a fact about the page, not about
//     `totalCost` — the column and the footer have to move together, off one request.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: FleetSeedT

test.beforeAll(async ({ browser }) => {
  seed = await seedFleet(browser)
})

// Mirrors seed-fleet.ts: one przegląd inside the window, one outside it.
const COST_INSIDE = 1500
const COST_OUTSIDE = 900
const WINDOW = 'from=2020-01-01&to=2020-12-31'

const TECHNICAL_COLUMN = 'Przegląd techniczny'
const COSTS_COLUMN = 'Koszty'

/** The global listing narrowed to this run's two vehicles — every figure below is then theirs. */
async function openFleet(page: Page, query = ''): Promise<void> {
  await page.goto(`/flota${query ? `?${query}` : ''}`)
  const search = page.getByPlaceholder('Szukaj...')
  await waitForHydration(search)
  await search.fill(seed.prefix)
  await expect(page.locator('table tbody tr')).toHaveCount(2)
}

const totalRow = (page: Page) => page.locator('tr').filter({ hasText: 'Razem' }).last()

test('okno dat zawęża „Koszty" i stopkę „Razem" jednym zapytaniem', async ({ page }) => {
  // The instrument's known-positive: without a window the car is worth both przeglądy, and the
  // footer says the same. A window that dropped everything would pass a test that only knows the
  // figure got smaller.
  await openFleet(page)
  await expectMoney(
    await tableCell(page, seed.costs.registration, COSTS_COLUMN),
    COST_INSIDE + COST_OUTSIDE,
    'kolumna „Koszty" bez okna',
  )
  await expectMoney(totalRow(page), COST_INSIDE + COST_OUTSIDE, 'stopka „Razem" bez okna')

  await openFleet(page, WINDOW)
  await expectMoney(
    await tableCell(page, seed.costs.registration, COSTS_COLUMN),
    COST_INSIDE,
    'kolumna „Koszty" w oknie',
  )
  await expectMoney(totalRow(page), COST_INSIDE, 'stopka „Razem" w oknie')
})

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
