import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import {
  columnIndex,
  openEditor,
  pickKosztorysOption,
  refreshReferenceData,
  runSeedScript,
} from './helpers'

// EX-689 (EX-682/683/688) — the sort scopes and „Zapisz kolejność", the command that turns a view
// into stored order.
//
// The four commands themselves, „Wyczyść sortowanie" and the band/order-command rules are already
// unit- and DOM-covered (`sort-menu-items.test.tsx`, `order-commands.test.ts`,
// `display-order.test.ts`, `kosztorys-renumber-kosztorys-order.test.ts`), and repeating them here
// would only prove them slower. What no layer below the browser reaches is the seam this spec sits
// on: a sort is a VIEW — nothing about it is in Postgres — so the only honest read of „the order was
// baked" is clearing the sort and reloading the page. Three facts hang on that reload:
//
//   • a GLOBAL sort bakes as if it were „zachowując sekcje" (the plan renumbers each section by the
//     same key), so the interleaved picture on screen is not what the reload brings back — and the
//     menu offering the command under that scope is only honest if what it writes is coherent;
//   • the undo of a bake is a second whole-sheet write, and „it looks undone" is exactly what a
//     local rollback that never reached the server looks like;
//   • the bake is computed from ALL rows, not the filtered ones, so a search phrase must not leave
//     the hidden rows interleaved among numbers the visible ones took.
test.use({ storageState: 'e2e/.auth/user.json' })

type SortSeedT = { bake: number; undo: number; search: number }

let seed: SortSeedT

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<SortSeedT>('seed:kosztorys-sort', 'SORT_SEED')
  await refreshReferenceData(browser)
})

const SORT_COLUMN = COLUMN_LABELS.plannedQty

// Seeded display order, with the przedmiar each row carries. Both sekcje run against the sort, so no
// expected order below can be the seeded one by accident.
const SEEDED = ['Alfa jeden', 'Alfa dwa', 'Alfa trzy', 'Beta jeden', 'Beta dwa', 'Beta trzy']
// Ascending przedmiar, each sekcja on its own — what every bake in this file must leave behind.
const BAKED_ASC = ['Alfa dwa', 'Alfa jeden', 'Alfa trzy', 'Beta jeden', 'Beta trzy', 'Beta dwa']

// The prace on screen, in row order. Read off the rendered text rather than a cell locator: „Opis
// prac" is a resting text node (the textarea mounts only while editing), and the section bands and
// „Razem" rows carry none of these names, so they drop out on their own.
async function itemOrder(page: Page): Promise<string[]> {
  const texts = await page.locator('.dsg-row').allTextContents()
  return texts
    .map((text) => SEEDED.find((name) => text.includes(name)))
    .filter((name): name is string => name !== undefined)
}

const bands = (page: Page) => page.locator('.dsg-row.kosztorys-section-header')

// react-datasheet-grid virtualises columns, so `columnIndex` leaves the grid scrolled to wherever
// the sorted column is — with „Opis prac" possibly off-screen and every row reading as empty. Every
// order read therefore comes back to the left edge first.
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

// ▲▼ i „Wstaw" pod aktywnym sortowaniem: kolejność w tablicy nie odpowiada już display_order, więc
// wstawienie „powyżej" wstawiłoby wiersz gdzie indziej, niż pokazuje ekran. Predykat jest pokryty
// jednostkowo — tutaj chodzi o to, czy menu wiersza w ogóle go czyta.
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

// A server action reply carries `next-action` on its POST, and it is the only observable end of one:
// `networkidle` never settles in this app. „Zapisz kolejność" and its undo are whole-sheet writes, so
// a reload fired before the reply would read the order the write was about to replace.
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

  // Globalne: obie sekcje wchodzą w jedną listę, więc przeplot jest tym, co odróżnia ten zakres od
  // „zachowując sekcje" — a znikające pasy sekcji są jedynym widocznym znakiem, że rozpiska
  // przestała być na chwilę pogrupowana.
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

  // Zapisany porządek to NIE jest przeplot ze zrzutu wyżej: plan przenumerowuje każdą sekcję tym
  // samym kluczem, więc wiersze wracają pod swoje sekcje posortowane wewnątrz nich.
  await clearSort(page)
  await expect(bands(page)).toHaveCount(2)
  await expectOrder(page, BAKED_ASC)

  // Siatka trzyma własny `rows` w stanie, więc „widać na ekranie" i „jest w Postgresie" to dwa różne
  // fakty — dopiero przeładowanie odpowiada na ten drugi.
  await page.reload()
  await expectOrder(page, BAKED_ASC)
})

test('cofnięcie „Zapisania kolejności" wraca do poprzedniego display_order po przeładowaniu', async ({
  page,
}) => {
  await openEditor(page, seed.undo)
  await expectOrder(page, SEEDED)

  await sortBy(page, 'Sortuj malejąco zachowując sekcje')
  // Pasy sekcji zostają pod tym zakresem, więc nic na ekranie nie mówi, że ręczna kolejność jest
  // zamrożona — poza samym menu wiersza.
  await expectRowCommandsFrozen(page, 'Alfa jeden', true)
  await persistOrder(page)
  await clearSort(page)
  const bakedDesc = ['Alfa trzy', 'Alfa jeden', 'Alfa dwa', 'Beta dwa', 'Beta trzy', 'Beta jeden']
  await expectOrder(page, bakedDesc)
  await expectRowCommandsFrozen(page, 'Alfa jeden', false)

  // Cofnięcie jest drugim zapisem całej rozpiski, a nie zdjęciem pierwszego — lokalne wycofanie,
  // które nigdy nie doszło do serwera, wygląda na ekranie identycznie.
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

  // Wiersze beta nigdy nie były na ekranie, a mimo to muszą wyjść z zapisu uporządkowane: numeruje
  // się całą rozpiskę, bo inaczej ukryte wiersze zostałyby wplecione między numery zabrane przez
  // widoczne.
  await page.reload()
  await expectOrder(page, BAKED_ASC)
})
