import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { DEFAULT_ITEM_DESCRIPTION } from '@/lib/kosztorys/constants'
import {
  collapseSummaryPanel,
  openEditor,
  pickKosztorysOption,
  refreshReferenceData,
  rowCell,
  runSeedScript,
} from './helpers'

// EX-472 (with EX-505 and EX-752 folded in) — the editor's three structure menus: „Akcje wiersza" on
// a praca, „Akcje sekcji" on a band, and „Dodaj" in the toolbar.
//
// The ORDER arithmetic under these commands is already settled below the browser:
// `kosztorys-create-order.test.ts` proves an append lands at the tail without a display_order
// collision, `move-edges.ts` has a unit for which direction is live at which position, and
// `append-preset-sections.test.ts` covers the preset append. Repeating any of that here would only
// prove it slower.
//
// What no layer below the browser reaches is that a MENU ENTRY is wired to the arithmetic at all —
// and that is where these commands have actually failed. Three distinct wiring bugs live here:
//   • an entry that renders live and silently does nothing (the reason `sortActive` gates exist);
//   • an edge predicate fed the FILTERED rows instead of the whole rozpiska, which greys out a move
//     the moment someone types in the search box;
//   • a praca appended to the section the grid happens to be showing rather than the one picked in
//     the submenu — invisible in the same session, because the grid patches its own `rows` state.
//
// The grid seeds `useState` at mount, so „the row is there now" and „the row is there after a
// reload" are two different facts. Every test below asserts them in that order.
test.use({ storageState: 'e2e/.auth/user.json' })

type StructureSeedT = {
  items: number
  sections: number
  target: number
  presetA: number
  presetB: number
  presetAppend: number
}

let seed: StructureSeedT

// One investment per test — every test here rewrites display_order, so a shared rozpiska would make
// each one depend on what the previous left behind. See seed-kosztorys-structure.ts.
test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<StructureSeedT>('seed:kosztorys-structure', 'STRUCTURE_SEED')
  await refreshReferenceData(browser)
})

// The rozpiska as the grid renders it, top to bottom: „# nazwa" for a section band, the praca's opis
// for an item row — so a freshly added one shows up under its default opis, which is how the commands
// under test announce themselves.
//
// Rows are told apart by what they CARRY, not by index: a band holds its name in an input (the
// inline rename), an item row is the only kind with an „Akcje wiersza" trigger, and the „Razem"
// footers, the spacer and the grand total have neither. The opis column is located through the
// header row inside the page, so this survives a column being added to its left.
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

// Every structure command is a server action, and the grid patches its own state the moment the
// action resolves — so a reload is the only reader that separates „the grid moved the row" from „the
// row moved in Postgres".
// Fire a menu command and wait for its server action to come back. The write is safe either way — it
// is the SCREEN that loses the race: the router applies each action's reply as a re-render, and a
// command issued while the previous reply is still in flight is painted over by it, leaving a row
// that Postgres has already dropped on screen with nothing left to click. Nothing in the DOM
// announces that reply, so the wait is on the action's own response.
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

  // „Wstaw powyżej" is the command that has to land at an INDEX rather than at the tail, which is
  // where a display_order collision would show: the new praca and the one it displaced would both
  // claim the same slot, and the reload below would then order them by id instead.
  await openRowMenu(page, 'Praca alfa dwa')
  await runCommand(page, 'Wstaw powyżej')
  const afterInsert = [
    '# Sekcja alfa',
    'Praca alfa jeden',
    DEFAULT_ITEM_DESCRIPTION,
    'Praca alfa dwa',
    'Praca alfa trzy',
    '# Sekcja beta',
    'Praca beta jeden',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterInsert)

  // Reloaded between the two commands, and not only to read the insert back: each command lands its
  // own router transition, and a second command fired while the first one's payload is still in
  // flight is re-rendered away by it. A reload is the one barrier nothing crosses — and it is what
  // separates „the grid put the row there" from „the row is in Postgres at that slot".
  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterInsert)

  // Deleting the praca BELOW the insert is what proves the new display_order is a real sequence
  // rather than two rows sharing a slot: the rows on both sides of the gap keep their order.
  await openRowMenu(page, 'Praca alfa trzy')
  await menuItem(page, 'Usuń pozycję').click()
  const deleted = serverAction(page)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click()
  await deleted

  const afterDelete = [
    '# Sekcja alfa',
    'Praca alfa jeden',
    DEFAULT_ITEM_DESCRIPTION,
    'Praca alfa dwa',
    '# Sekcja beta',
    'Praca beta jeden',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterDelete)

  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterDelete)
})

test('the section band menu reorders sekcje, dies at the edges of the rozpiska, and ignores the search box', async ({
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

  // Both ends, in one open menu each: at the first sekcja „w górę" has nothing to swap with, at the
  // last „w dół" hasn't — and the OTHER direction staying live is what makes this a per-direction
  // predicate rather than a menu that went dead altogether.
  await openSectionMenu(page, 'Sekcja wiodąca')
  await expect(menuItem(page, 'Przesuń sekcję w górę')).toBeDisabled()
  await expect(menuItem(page, 'Przesuń sekcję w dół')).toBeEnabled()
  await page.keyboard.press('Escape')

  await openSectionMenu(page, 'Sekcja zamykająca')
  await expect(menuItem(page, 'Przesuń sekcję w dół')).toBeDisabled()
  await expect(menuItem(page, 'Przesuń sekcję w górę')).toBeEnabled()
  await page.keyboard.press('Escape')

  // Narrowing the view to ONE sekcja must not move the edges: they are positions in the rozpiska, not
  // in what is on screen. Unfixed, this is where the predicate reads the filtered rows and greys out
  // a move that is perfectly legal.
  await page.getByPlaceholder('Szukaj…').fill('środkowa')
  await expect.poll(() => rozpiska(page)).toEqual(['# Sekcja środkowa', 'Robota środkowa'])
  await openSectionMenu(page, 'Sekcja środkowa')
  await expect(menuItem(page, 'Przesuń sekcję w górę')).toBeEnabled()
  await expect(menuItem(page, 'Przesuń sekcję w dół')).toBeEnabled()
  await page.keyboard.press('Escape')
  // Not cosmetic: dsg rows are positioned by index and recycled, so a band trigger resolved while the
  // search is still being undone belongs to a different sekcja by the time the click lands — which
  // reads as „the move went dead" rather than as the race it is.
  await page.getByPlaceholder('Szukaj…').fill('')
  await expect.poll(() => rozpiska(page)).toEqual(initial)

  await openSectionMenu(page, 'Sekcja środkowa')
  await runCommand(page, 'Przesuń sekcję w górę')
  const afterMove = [
    '# Sekcja środkowa',
    'Robota środkowa',
    '# Sekcja wiodąca',
    'Robota wiodąca',
    '# Sekcja zamykająca',
    'Robota zamykająca',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterMove)

  // A sekcja carries its prace when it moves — asserting the band alone would pass on a reorder that
  // left the rows behind under the wrong band.
  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterMove)

  // Under a sort the array position stops mirroring display_order, so every order command freezes.
  // „Wstaw sekcję" is in the same freeze as the moves, and „Usuń sekcję" is deliberately NOT: the
  // gate is about position, not about the sekcja.
  await sortBy(page, COLUMN_LABELS.description, 'Sortuj rosnąco zachowując sekcje')
  await openSectionMenu(page, 'Sekcja środkowa')
  await expect(menuItem(page, 'Przesuń sekcję w górę')).toBeDisabled()
  await expect(menuItem(page, 'Przesuń sekcję w dół')).toBeDisabled()
  await expect(menuItem(page, 'Wstaw sekcję powyżej')).toBeDisabled()
  await expect(menuItem(page, 'Usuń sekcję')).toBeEnabled()
  await page.keyboard.press('Escape')

  // A GLOBAL sort drops the bands entirely, so the section menu goes with them — one flat list is
  // the whole point of that scope, and a band left standing over rows from three sekcje would lie.
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

  const afterAdd = [
    '# Sekcja pierwsza',
    'Zadanie pierwsze',
    '# Sekcja docelowa',
    'Zadanie docelowe',
    DEFAULT_ITEM_DESCRIPTION,
    '# Sekcja ostatnia',
    'Zadanie ostatnie',
  ]
  await expect.poll(() => rozpiska(page)).toEqual(afterAdd)

  // The grid patches its own rows from the action's answer, so the session that added the praca sees
  // it under the right band whether or not the server agreed about which band that was.
  await reloadEditor(page)
  await expect.poll(() => rozpiska(page)).toEqual(afterAdd)
})

// The entry carries its one-line explanation inside the item, so the accessible name does too — and
// „Zapisz" alone matches several rows of the „Opcje" menu.
const SAVE_PRESET_ITEM = /Zapisz jako wzór do użycia na innych inwestycjach/

const presetDialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Dodaj sekcję z szablonu' })

// Cut a szablon off a kosztorys through the real dialog. A preset payload is written by
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

// Left pane: narrow to one szablon and open it. The rows carry their sekcja counts, so the name is a
// substring of the accessible name rather than the whole of it.
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

  // One sekcja out of szablon A's two: „Zaznacz wszystkie" is a different command, and a szablon
  // taken whole could not show that the picked sekcja is the one that crossed.
  await openPreset(page, presetA)
  await presetDialog(page).getByRole('button', { name: 'Sekcja szablonu A' }).click()
  await expect(presetDialog(page).getByRole('button', { name: 'Dodaj (1)' })).toBeVisible()

  // Switching szablon means FILTERING szablon A out of the left pane — the selection lives in a
  // `Set<"presetId:sectionId">` above both panes, and a regress that hangs it off the visible list
  // drops the first pick silently. The counter is the only place on screen that says otherwise.
  await openPreset(page, presetB)
  await presetDialog(page).getByRole('button', { name: 'Sekcja szablonu B' }).click()
  const confirm = presetDialog(page).getByRole('button', { name: 'Dodaj (2)' })
  await expect(confirm).toBeVisible()

  const appended = serverAction(page)
  await confirm.click()
  await appended

  // Both sekcje at the TAIL, behind the rozpiska that was already there — and in the order the
  // picker lists szablony (newest first), which is what the append follows. „Sekcja pominięta A" is
  // the control: it rode along in the same szablon and was never ticked.
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

  // What a szablon carries and what it drops, on a praca that crossed: the cena comes along, the
  // przedmiar is this job's own fact and arrives zeroed. Both cells are typed by hand, so the figure
  // lives in the input's value and never in a text node.
  const przedmiar = await rowCell(page, 'Praca z szablonu A', COLUMN_LABELS.plannedQty)
  await expect(przedmiar.locator('input')).toHaveValue('0')
  const cena = await rowCell(page, 'Praca z szablonu A', COLUMN_LABELS.price)
  await expect(cena.locator('input')).toHaveValue('100')
})
