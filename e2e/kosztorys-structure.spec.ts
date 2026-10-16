import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import {
  collapseSummaryPanel,
  openEditor,
  pickKosztorysOption,
  rowCell,
} from './drivers/kosztorys-grid'

test.use({ storageState: 'e2e/.auth/user.json' })

type StructureSeedT = {
  items: number
  sections: number
  target: number
  presetA: number
  presetB: number
  presetAppend: number
  bare: number
}

let seed: StructureSeedT

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<StructureSeedT>('seed:kosztorys-structure', 'STRUCTURE_SEED')
  await refreshReferenceData(browser)
})

// Rows are told apart by what they CARRY, not by index: a band holds its name in an input (the
// inline rename), an item row is the only kind with an „Akcje wiersza" trigger, and the „Razem"
// footers, the spacer and the grand total have neither.
async function rozpiska(page: Page): Promise<string[]> {
  await page.locator('.dsg-row.dsg-row-header').first().waitFor()
  return page.evaluate((opisLabel) => {
    const header = document.querySelector('.dsg-row.dsg-row-header')
    const headers = [...(header?.querySelectorAll('.dsg-cell') ?? [])]
    const opis = headers.findIndex((cell) => cell.textContent?.trim() === opisLabel)
    if (opis < 0) throw new Error(`no „${opisLabel}" column in the grid`)

    return [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')].flatMap((row) => {
      const cell = row.querySelectorAll('.dsg-cell')[opis]
      if (row.classList.contains('kosztorys-section-header')) {
        const input = cell?.querySelector('input')
        return [`# ${input instanceof HTMLInputElement ? input.value : ''}`]
      }
      if (!row.querySelector('[title="Akcje wiersza"]')) return []
      return [(cell?.textContent ?? '').trim()]
    })
  }, COLUMN_LABELS.description)
}

const band = (page: Page, name: string) =>
  page
    .locator('.dsg-row.kosztorys-section-header')
    .filter({ has: page.locator(`input[value="${name}"]`) })

const itemRow = (page: Page, text: string) =>
  page
    .locator('.dsg-row')
    .filter({ hasText: text })
    .filter({ has: page.locator('[title="Akcje wiersza"]') })

async function openRowMenu(page: Page, text: string): Promise<void> {
  await itemRow(page, text).locator('[title="Akcje wiersza"]').click()
}

async function openSectionMenu(page: Page, name: string): Promise<void> {
  await band(page, name).locator('[title="Akcje sekcji"]').click()
}

const menuItem = (page: Page, name: string | RegExp) => page.getByRole('menuitem', { name })

// The write is safe either way — it is the SCREEN that loses the race: the router applies each
// action's reply as a re-render, and a command issued while the previous reply is still in flight is
// painted over by it.
function serverAction(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.request().headers()['next-action'] !== undefined,
  )
}

async function runCommand(page: Page, command: string | RegExp): Promise<void> {
  const settled = serverAction(page)
  await menuItem(page, command).click()
  await settled
}

const newItemDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Nowa praca' })

async function fillNewItem(
  page: Page,
  description: string,
  { catalogue = false }: { catalogue?: boolean } = {},
): Promise<void> {
  const dialog = newItemDialog(page)
  await dialog.getByLabel('Opis pracy').fill(description)
  await dialog.getByRole('combobox', { name: 'Wybierz lub wpisz nową…' }).first().click()
  await page.keyboard.type('m²')
  await page.keyboard.press('Enter')
  await dialog.getByLabel('Cena j.m. (PLN)').fill('50')
  if (catalogue) {
    await dialog.getByRole('checkbox', { name: 'Dodaj pracę do katalogu prac' }).click()
  }
}

async function saveNewItem(page: Page): Promise<void> {
  const saved = serverAction(page)
  await newItemDialog(page).getByRole('button', { name: 'Dodaj', exact: true }).click()
  await saved
  await expect(newItemDialog(page)).toHaveCount(0)
}

async function reloadEditor(page: Page): Promise<void> {
  await page.reload()
  await collapseSummaryPanel(page)
}

async function sortBy(page: Page, column: string, command: string | RegExp): Promise<void> {
  await page
    .locator('.dsg-row.dsg-row-header .dsg-cell')
    .filter({ hasText: column })
    .getByRole('button')
    .first()
    .click()
  await menuItem(page, command).click()
}

test('inserting and deleting prace through the row menu rewrites the order, and the order survives a reload', async ({
  page,
}) => {
  await openEditor(page, seed.items)
  await expect
    .poll(() => rozpiska(page))
    .toEqual([
      '# Sekcja alfa',
      'Praca alfa jeden',
      'Praca alfa dwa',
      'Praca alfa trzy',
      '# Sekcja beta',
      'Praca beta jeden',
    ])

  await openRowMenu(page, 'Praca alfa dwa')
  await menuItem(page, 'Wstaw powyżej').click()
  await fillNewItem(page, 'Praca wstawiona')
  await saveNewItem(page)
  const afterInsert = [
    '# Sekcja alfa',
    'Praca alfa jeden',
    'Praca wstawiona',
    'Praca alfa dwa',
    'Praca alfa trzy',
    '# Sekcja beta',
    'Praca beta jeden',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterInsert)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterInsert)

  await openRowMenu(page, 'Praca alfa trzy')
  await menuItem(page, 'Usuń pozycję').click()
  const deleted = serverAction(page)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click()
  await deleted

  const afterDelete = [
    '# Sekcja alfa',
    'Praca alfa jeden',
    'Praca wstawiona',
    'Praca alfa dwa',
    '# Sekcja beta',
    'Praca beta jeden',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterDelete)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterDelete)
})

test('the section band menu freezes its insert under a sort, and a global sort drops the bands', async ({
  page,
}) => {
  const initial = [
    '# Sekcja wiodąca',
    'Robota wiodąca',
    '# Sekcja środkowa',
    'Robota środkowa',
    '# Sekcja zamykająca',
    'Robota zamykająca',
  ]
  await openEditor(page, seed.sections)
  await expect.poll(() => rozpiska(page)).toEqual(initial)

  await sortBy(page, COLUMN_LABELS.description, 'Sortuj rosnąco zachowując sekcje')
  await openSectionMenu(page, 'Sekcja środkowa')
  await expect(menuItem(page, 'Wstaw sekcję powyżej')).toBeDisabled()
  await expect(menuItem(page, 'Usuń sekcję')).toBeEnabled()
  await page.keyboard.press('Escape')

  await sortBy(page, COLUMN_LABELS.description, /^Sortuj rosnąco$/)
  await expect(page.locator('.dsg-row.kosztorys-section-header')).toHaveCount(0)
  await expect
    .poll(() => rozpiska(page))
    .toEqual(['Robota środkowa', 'Robota wiodąca', 'Robota zamykająca'])
})

test('„Dodaj → Praca" lands in the sekcja picked in the submenu, not the one on screen', async ({
  page,
}) => {
  await openEditor(page, seed.target)

  // Deliberately neither the first nor the last sekcja: a praca appended „somewhere" still passes
  // against a two-section rozpiska, and appending to the tail is the bug this guards against.
  await page.getByRole('button', { name: 'Dodaj' }).click()
  await page.getByRole('menuitem', { name: 'Praca', exact: true }).click()
  await menuItem(page, 'Sekcja docelowa').click()
  // The katalog is global and never reset, so the opis is this run's own — a second run would
  // otherwise collide with the first run's entry.
  const description = `Zadanie z katalogu ${Date.now()}`
  await fillNewItem(page, description, { catalogue: true })
  await saveNewItem(page)

  const afterAdd = [
    '# Sekcja pierwsza',
    'Zadanie pierwsze',
    '# Sekcja docelowa',
    'Zadanie docelowe',
    description,
    '# Sekcja ostatnia',
    'Zadanie ostatnie',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterAdd)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterAdd)

  await openSectionMenu(page, 'Sekcja docelowa')
  await page.getByRole('menuitem', { name: 'Dodaj pracę', exact: true }).click()
  await fillNewItem(page, description, { catalogue: true })
  await newItemDialog(page).getByRole('button', { name: 'Dodaj', exact: true }).click()
  const collision = page.getByRole('alertdialog').filter({ hasText: 'jest już w katalogu' })
  await expect(collision).toBeVisible()
  await collision.getByRole('button', { name: 'Wróć' }).click()
  await page.keyboard.press('Escape')
  await expect(newItemDialog(page)).toHaveCount(0)
  await expect.poll(() => rozpiska(page)).toEqual(afterAdd)
})

test('„Dodaj → Sekcja" puts a bare band on top, „Dodaj pracę" fills it, and its last delete leaves it bare', async ({
  page,
}) => {
  await openEditor(page, seed.bare)

  await page.getByRole('button', { name: 'Dodaj' }).click()
  await runCommand(page, 'Sekcja')
  const bare = [`# ${DEFAULT_SECTION_NAME}`, '# Sekcja istniejąca', 'Praca istniejąca']
  await expect.poll(() => rozpiska(page)).toEqual(bare)
  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(bare)

  await band(page, DEFAULT_SECTION_NAME).getByRole('button', { name: 'Dodaj pracę' }).click()
  await fillNewItem(page, 'Pierwsza praca sekcji')
  await saveNewItem(page)
  const filled = [
    `# ${DEFAULT_SECTION_NAME}`,
    'Pierwsza praca sekcji',
    '# Sekcja istniejąca',
    'Praca istniejąca',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(filled)
  await expect(
    band(page, DEFAULT_SECTION_NAME).getByRole('button', { name: 'Dodaj pracę' }),
  ).toHaveCount(0)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(filled)

  await openRowMenu(page, 'Pierwsza praca sekcji')
  await menuItem(page, 'Usuń pozycję').click()
  const deleted = serverAction(page)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click()
  await deleted
  await expect.poll(() => rozpiska(page)).toEqual(bare)
  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(bare)
})

// „Zapisz" alone matches several rows of the „Opcje" menu.
const SAVE_PRESET_ITEM = /Zapisz jako wzór do użycia na innych inwestycjach/

const presetDialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Dodaj sekcję z szablonu' })

// A preset payload is written by
// `serializeKosztorysAsPreset`, which is `server-only` and out of a seed script's reach, so the
// library this test reads has to be one the app itself wrote.
async function savePreset(page: Page, investmentId: number, name: string): Promise<void> {
  await openEditor(page, investmentId)
  await pickKosztorysOption(page, SAVE_PRESET_ITEM)
  const dialog = page.getByRole('dialog').filter({ hasText: 'Zapisz jako nowy szablon' })
  await dialog.getByPlaceholder('Nazwa szablonu').fill(name)
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 20_000 })
}

async function openPreset(page: Page, name: string): Promise<void> {
  await presetDialog(page).getByPlaceholder('Szukaj szablonu…').fill(name)
  await presetDialog(page).getByRole('button', { name }).click()
}

test('„Sekcja z szablonu…" zbiera zaznaczenia z dwóch szablonów i dokleja obie sekcje na koniec rozpiski', async ({
  page,
}) => {
  // The szablon library is GLOBAL and the test DB is never reset, so both names have to be this
  // run's own — otherwise the second run picks the first run's szablon out of the left pane.
  const stamp = Date.now()
  const presetA = `E2E Struktura szablon A ${stamp}`
  const presetB = `E2E Struktura szablon B ${stamp}`
  await savePreset(page, seed.presetA, presetA)
  await savePreset(page, seed.presetB, presetB)

  await openEditor(page, seed.presetAppend)
  await page.getByRole('button', { name: 'Dodaj' }).click()
  await menuItem(page, 'Sekcja z szablonu…').click()

  await openPreset(page, presetA)
  await presetDialog(page).getByRole('button', { name: 'Sekcja szablonu A' }).click()
  await expect(presetDialog(page).getByRole('button', { name: 'Dodaj (1)' })).toBeVisible()

  await openPreset(page, presetB)
  await presetDialog(page).getByRole('button', { name: 'Sekcja szablonu B' }).click()
  const confirm = presetDialog(page).getByRole('button', { name: 'Dodaj (2)' })
  await expect(confirm).toBeVisible()

  const appended = serverAction(page)
  await confirm.click()
  await appended

  // Both sekcje at the TAIL, behind the rozpiska that was already there — and in the order the
  // picker lists szablony (newest first), which is what the append follows.
  const afterAppend = [
    '# Sekcja zastana',
    'Praca zastana',
    '# Sekcja szablonu B',
    'Praca z szablonu B',
    '# Sekcja szablonu A',
    'Praca z szablonu A',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterAppend)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterAppend)

  // Both cells are typed by hand, so the figure
  // lives in the input's value and never in a text node.
  const przedmiar = await rowCell(page, 'Praca z szablonu A', COLUMN_LABELS.plannedQty)
  await expect(przedmiar.locator('input')).toHaveValue('0')
  const cena = await rowCell(page, 'Praca z szablonu A', COLUMN_LABELS.price)
  await expect(cena.locator('input')).toHaveValue('100')
})
