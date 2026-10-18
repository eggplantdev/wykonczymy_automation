import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { type E2ESeedsT, readSeed } from './support/seeds'
import { clickAndSettle, settleWrite } from './support/wait'
import {
  columnIndex,
  GRID_VIEWPORT,
  openEditor,
  openRowMenu,
  pickKosztorysOption,
  sectionBands,
} from './drivers/kosztorys-grid'

test.use({ viewport: GRID_VIEWPORT })

let seed: E2ESeedsT['sort']

test.beforeAll(() => {
  seed = readSeed('sort')
})

const SORT_COLUMN = COLUMN_LABELS.plannedQty

// Both sekcje run through the sort, so none of the expected orders below can equal the seed by accident.
const SEEDED = ['Alfa jeden', 'Alfa dwa', 'Alfa trzy', 'Beta jeden', 'Beta dwa', 'Beta trzy']
const BAKED_ASC = ['Alfa dwa', 'Alfa jeden', 'Alfa trzy', 'Beta jeden', 'Beta trzy', 'Beta dwa']

// Reads rendered text, not a cell locator: „Opis prac" is a textarea that mounts only while editing,
// and section/„Razem" rows have no matching name and drop out on their own.
async function itemOrder(page: Page): Promise<string[]> {
  const texts = await page.locator('.dsg-row').allTextContents()
  return texts
    .map((text) => SEEDED.find((name) => text.includes(name)))
    .filter((name): name is string => name !== undefined)
}

// dsg virtualises columns, so opening a column menu can scroll „Opis prac" off-screen; reads always
// scroll back to the left edge first.
async function openColumnMenu(page: Page, header: string): Promise<void> {
  const index = await columnIndex(page, header)
  await page.locator('.dsg-row.dsg-row-header .dsg-cell').nth(index).getByRole('button').click()
}

async function scrollGridHome(page: Page): Promise<void> {
  await page
    .locator('.dsg-container')
    .first()
    .evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
}

async function expectOrder(page: Page, expected: string[]): Promise<void> {
  await scrollGridHome(page)
  await expect.poll(() => itemOrder(page)).toEqual(expected)
}

// Pod sortowaniem kolejność w tablicy nie zgadza się z display_order — „Wstaw powyżej" wstawiłby
// wiersz gdzie indziej niż pokazuje ekran.
async function expectRowCommandsFrozen(
  page: Page,
  rowText: string,
  frozen: boolean,
): Promise<void> {
  await scrollGridHome(page)
  await openRowMenu(page, rowText)
  const entry = page.getByRole('menuitem', { name: 'Wstaw powyżej', exact: true })
  // `not.toHaveAttribute` is satisfied by an element that isn't there at all, so the live case has
  // to say the entry exists before it says it is live.
  await expect(entry).toBeVisible()
  if (frozen) await expect(entry).toHaveAttribute('aria-disabled', 'true')
  else await expect(entry).not.toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
}

// Sort picks keep the menu open, so every command closes it before the next click.
async function sortBy(page: Page, command: string | RegExp): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  await page.getByRole('menuitem', { name: command, exact: true }).click()
  await page.keyboard.press('Escape')
}

// Reloading before the reply would race the write it's about to replace.
async function persistOrder(page: Page): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  await clickAndSettle(page.getByRole('menuitem', { name: 'Zapisz kolejność', exact: true }))
  await page.keyboard.press('Escape')
}

async function clearSort(page: Page): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  await page.getByRole('menuitem', { name: 'Wyczyść sortowanie', exact: true }).click()
  await page.keyboard.press('Escape')
}

test('„Zapisz kolejność" pod sortowaniem globalnym przeżywa wyczyszczenie sortowania i przeładowanie', async ({
  page,
}) => {
  await openEditor(page, seed.bake)
  await expectOrder(page, SEEDED)
  await expect(sectionBands(page)).toHaveCount(2)

  await sortBy(page, 'Sortuj rosnąco')
  await expectOrder(page, [
    'Alfa dwa',
    'Beta jeden',
    'Alfa jeden',
    'Beta trzy',
    'Alfa trzy',
    'Beta dwa',
  ])
  await expect(sectionBands(page)).toHaveCount(0)

  await persistOrder(page)

  await clearSort(page)
  await expect(sectionBands(page)).toHaveCount(2)
  await expectOrder(page, BAKED_ASC)

  await page.reload()
  await expectOrder(page, BAKED_ASC)
})

test('cofnięcie „Zapisania kolejności" wraca do poprzedniego display_order po przeładowaniu', async ({
  page,
}) => {
  await openEditor(page, seed.undo)
  await expectOrder(page, SEEDED)

  await sortBy(page, 'Sortuj malejąco zachowując sekcje')
  await expectRowCommandsFrozen(page, 'Alfa jeden', true)
  await persistOrder(page)
  await clearSort(page)
  const bakedDesc = ['Alfa trzy', 'Alfa jeden', 'Alfa dwa', 'Beta dwa', 'Beta trzy', 'Beta jeden']
  await expectOrder(page, bakedDesc)
  await expectRowCommandsFrozen(page, 'Alfa jeden', false)

  await settleWrite(page, () => pickKosztorysOption(page, /^Cofnij/))
  await expectOrder(page, SEEDED)

  await page.reload()
  await expectOrder(page, SEEDED)
})

test('zapis przy wpisanej frazie porządkuje całą rozpiskę, nie tylko widoczne wiersze', async ({
  page,
}) => {
  await openEditor(page, seed.search)
  await page.getByPlaceholder('Szukaj…').fill('Alfa')
  await expectOrder(page, ['Alfa jeden', 'Alfa dwa', 'Alfa trzy'])

  await sortBy(page, 'Sortuj rosnąco')
  await expectOrder(page, ['Alfa dwa', 'Alfa jeden', 'Alfa trzy'])
  await persistOrder(page)

  await page.reload()
  await expectOrder(page, BAKED_ASC)
})
