import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import {
  columnIndex,
  openEditor,
  pickKosztorysOption,
  refreshReferenceData,
  runSeedScript,
} from './helpers'

// EX-689 — commands are unit/DOM-covered elsewhere; this spec proves what only a reload can: sort
// order is a VIEW until „Zapisz kolejność" bakes it, undo of a bake is a second write, and a bake
// covers all rows even under a search filter.
test.use({ storageState: 'e2e/.auth/user.json' })

type SortSeedT = { bake: number; undo: number; search: number }

let seed: SortSeedT

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<SortSeedT>('seed:kosztorys-sort', 'SORT_SEED')
  await refreshReferenceData(browser)
})

const SORT_COLUMN = COLUMN_LABELS.plannedQty

// Both sekcje run through the sort, so none of the expected orders below can equal the seed by accident.
const SEEDED = ['Alfa jeden', 'Alfa dwa', 'Alfa trzy', 'Beta jeden', 'Beta dwa', 'Beta trzy']
// The shape every ascending bake in this file must produce.
const BAKED_ASC = ['Alfa dwa', 'Alfa jeden', 'Alfa trzy', 'Beta jeden', 'Beta trzy', 'Beta dwa']

// Reads rendered text, not a cell locator: „Opis prac" is a textarea that mounts only while editing,
// and section/„Razem" rows have no matching name and drop out on their own.
async function itemOrder(page: Page): Promise<string[]> {
  const texts = await page.locator('.dsg-row').allTextContents()
  return texts
    .map((text) => SEEDED.find((name) => text.includes(name)))
    .filter((name): name is string => name !== undefined)
}

const bands = (page: Page) => page.locator('.dsg-row.kosztorys-section-header')

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
// wiersz gdzie indziej niż pokazuje ekran. Tu sprawdzamy, czy menu wiersza to honoruje.
async function expectRowCommandsFrozen(
  page: Page,
  rowText: string,
  frozen: boolean,
): Promise<void> {
  await scrollGridHome(page)
  await page
    .locator('.dsg-row')
    .filter({ hasText: rowText })
    .getByRole('button', { name: 'Akcje wiersza' })
    .click()
  for (const command of ['Wstaw powyżej', 'Przesuń w górę']) {
    const entry = page.getByRole('menuitem', { name: command, exact: true })
    // `not.toHaveAttribute` is satisfied by an element that isn't there at all, so the live case has
    // to say the entry exists before it says it is live.
    await expect(entry).toBeVisible()
    if (frozen) await expect(entry).toHaveAttribute('aria-disabled', 'true')
    else await expect(entry).not.toHaveAttribute('aria-disabled', 'true')
  }
  await page.keyboard.press('Escape')
}

async function sortBy(page: Page, command: string | RegExp): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  await page.getByRole('menuitem', { name: command, exact: true }).click()
}

// `next-action` marks a server action's POST; `networkidle` never settles in this app. Reloading
// before the reply would race the write it's about to replace.
function serverAction(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.request().headers()['next-action'] !== undefined,
  )
}

async function persistOrder(page: Page): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  const settled = serverAction(page)
  await page.getByRole('menuitem', { name: 'Zapisz kolejność', exact: true }).click()
  await settled
}

async function clearSort(page: Page): Promise<void> {
  await openColumnMenu(page, SORT_COLUMN)
  await page.getByRole('menuitem', { name: 'Wyczyść sortowanie', exact: true }).click()
}

test('„Zapisz kolejność" pod sortowaniem globalnym przeżywa wyczyszczenie sortowania i przeładowanie', async ({
  page,
}) => {
  await openEditor(page, seed.bake)
  await expectOrder(page, SEEDED)
  await expect(bands(page)).toHaveCount(2)

  // Globalne miesza obie sekcje w jedną listę — znikające pasy sekcji są jedynym widocznym znakiem
  // tego przeplotu, w odróżnieniu od „zachowując sekcje".
  await sortBy(page, 'Sortuj rosnąco')
  await expectOrder(page, [
    'Alfa dwa',
    'Beta jeden',
    'Alfa jeden',
    'Beta trzy',
    'Alfa trzy',
    'Beta dwa',
  ])
  await expect(bands(page)).toHaveCount(0)

  await persistOrder(page)

  // Zapis przenumerowuje każdą sekcję tym samym kluczem, więc wiersze wracają pogrupowane, nie w
  // przeplocie sprzed zapisu.
  await clearSort(page)
  await expect(bands(page)).toHaveCount(2)
  await expectOrder(page, BAKED_ASC)

  // Siatka trzyma własny `rows`, więc dopiero przeładowanie sprawdza, czy zapis dotarł do Postgresa.
  await page.reload()
  await expectOrder(page, BAKED_ASC)
})

test('cofnięcie „Zapisania kolejności" wraca do poprzedniego display_order po przeładowaniu', async ({
  page,
}) => {
  await openEditor(page, seed.undo)
  await expectOrder(page, SEEDED)

  await sortBy(page, 'Sortuj malejąco zachowując sekcje')
  // Pasy sekcji zostają pod tym zakresem — poza menu wiersza nic na ekranie nie zdradza zamrożonej
  // ręcznej kolejności.
  await expectRowCommandsFrozen(page, 'Alfa jeden', true)
  await persistOrder(page)
  await clearSort(page)
  const bakedDesc = ['Alfa trzy', 'Alfa jeden', 'Alfa dwa', 'Beta dwa', 'Beta trzy', 'Beta jeden']
  await expectOrder(page, bakedDesc)
  await expectRowCommandsFrozen(page, 'Alfa jeden', false)

  // Cofnięcie to drugi zapis całej rozpiski — lokalne wycofanie, które nigdy nie doszło do serwera,
  // wygląda identycznie.
  const settled = serverAction(page)
  await pickKosztorysOption(page, /^Cofnij/)
  await settled
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

  // Wiersze beta nigdy nie były na ekranie — zapis numeruje całą rozpiskę, inaczej ukryte wiersze
  // wplotłyby się między numery zajęte przez widoczne.
  await page.reload()
  await expectOrder(page, BAKED_ASC)
})
