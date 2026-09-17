import { test, expect, type Locator, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { openEditor, refreshReferenceData, rowCell, runSeedScript } from './helpers'

// EX-525 — unit-covered elsewhere (`use-undo-redo.test.ts`). Only a browser proves undo is a WRITE
// (a reload tells a real revert from a local-only one), a keystroke run coalesces into one command
// (`UNDO_COALESCE_MS`), and Cmd+Z belongs to the input while text-editing, our stack only after.
test.use({ storageState: 'e2e/.auth/user.json' })

type UndoSeedT = { cell: number; burst: number; boundary: number; reorder: number }

let seed: UndoSeedT

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<UndoSeedT>('seed:kosztorys-undo', 'UNDO_SEED')
  await refreshReferenceData(browser)
})

const QTY_COLUMN = COLUMN_LABELS.plannedQty
// Seeded przedmiary, all distinct so a reverted one cannot be read off a neighbour by accident.
const SEEDED_QTY = { 'Praca pierwsza': '11', 'Praca druga': '22', 'Praca trzecia': '33' }

// `next-action` marks a server action's POST; `networkidle` never settles here. An undo is a write
// like any edit, so reloading before the reply would race the value it's about to replace.
function serverAction(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.request().headers()['next-action'] !== undefined,
  )
}

const qtyCell = (page: Page, row: string): Promise<Locator> => rowCell(page, row, QTY_COLUMN)

// The cell renders an `EditableCellInput`, so the figure lives in `value`, never a text node.
async function typeQty(page: Page, row: string, value: string): Promise<void> {
  const cell = await qtyCell(page, row)
  await cell.click()
  const settled = serverAction(page)
  await cell.locator('input').fill(value)
  await page.keyboard.press('Enter')
  await settled
}

async function expectQty(page: Page, row: string, value: string): Promise<void> {
  await expect((await qtyCell(page, row)).locator('input')).toHaveValue(value, { timeout: 20_000 })
}

const optionsMenuItem = (page: Page, command: RegExp) =>
  page.getByRole('menuitem', { name: command })

const optionsMenu = (page: Page) => page.getByRole('menu', { name: 'Opcje' })

// Radix marks the background `aria-hidden` under an open menu, hiding „Opcje" itself until the
// previous one collapses — so waiting for that close belongs inside opening.
async function openOptionsMenu(page: Page): Promise<void> {
  await expect(optionsMenu(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Opcje', exact: true }).click()
  await expect(optionsMenu(page)).toBeVisible()
}

async function closeOptionsMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(optionsMenu(page)).toHaveCount(0)
}

async function runStackCommand(page: Page, command: RegExp): Promise<void> {
  await openOptionsMenu(page)
  const settled = serverAction(page)
  await optionsMenuItem(page, command).click()
  await expect(optionsMenu(page)).toHaveCount(0)
  await settled
}

const UNDO = /^Cofnij/
const REDO = /^Ponów/

async function expectStackState(page: Page, undo: boolean, redo: boolean): Promise<void> {
  await openOptionsMenu(page)
  for (const [command, enabled] of [
    [UNDO, undo],
    [REDO, redo],
  ] as const) {
    const entry = optionsMenuItem(page, command)
    await expect(entry).toBeVisible()
    if (enabled) await expect(entry).not.toHaveAttribute('aria-disabled', 'true')
    else await expect(entry).toHaveAttribute('aria-disabled', 'true')
  }
  await closeOptionsMenu(page)
}

test('cofnięcie i ponowienie edycji komórki sięgają bazy, nie tylko ekranu', async ({ page }) => {
  await openEditor(page, seed.cell)
  await expectQty(page, 'Praca druga', SEEDED_QTY['Praca druga'])

  await typeQty(page, 'Praca druga', '99')
  await expectQty(page, 'Praca druga', '99')

  await runStackCommand(page, UNDO)
  await expectQty(page, 'Praca druga', SEEDED_QTY['Praca druga'])

  // Reload proves the undo reached Postgres, and it also wipes the stack — hence redo below gets
  // its own fresh edit.
  await page.reload()
  await expectQty(page, 'Praca druga', SEEDED_QTY['Praca druga'])

  await typeQty(page, 'Praca druga', '99')
  await runStackCommand(page, UNDO)
  await expectQty(page, 'Praca druga', SEEDED_QTY['Praca druga'])
  await runStackCommand(page, REDO)
  await expectQty(page, 'Praca druga', '99')

  await page.reload()
  await expectQty(page, 'Praca druga', '99')
})

test('seria znaków to jedno cofnięcie, a „Opcje" pokazują, jak głęboki jest stos', async ({
  page,
}) => {
  await openEditor(page, seed.burst)
  // Toolbar mounts together with the grid, so querying the stack before the first row read can hit
  // the moment „Opcje" doesn't exist yet.
  await expectQty(page, 'Praca pierwsza', SEEDED_QTY['Praca pierwsza'])
  await expectStackState(page, false, false)

  // Character by character, not `fill`: coalescing (UNDO_COALESCE_MS) only shows up when each key
  // is its own `onChange` — `fill` fires one event and would pass even without coalescing.
  const cell = await qtyCell(page, 'Praca pierwsza')
  await cell.click()
  const settled = serverAction(page)
  // Enter opens edit mode without typing, avoiding the race where a first keystroke is lost to the
  // grid before the input gets focus. Delay stays under UNDO_COALESCE_MS so all land in one buffer.
  await page.keyboard.press('Enter')
  await expect(cell.locator('input')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('1234', { delay: 80 })
  await expect(cell.locator('input')).toHaveValue('1234')
  await page.keyboard.press('Enter')
  await settled
  await expectQty(page, 'Praca pierwsza', '1234')

  // The buffer only closes after a pause in typing — an undo before that would revert an empty series.
  await expectStackState(page, true, false)
  await runStackCommand(page, UNDO)
  await expectQty(page, 'Praca pierwsza', SEEDED_QTY['Praca pierwsza'])
  await expectStackState(page, false, true)

  // Świeża edycja ucina gałąź „ponów" — inaczej ponowienie wkleiłoby wartość z porzuconej historii.
  await typeQty(page, 'Praca druga', '77')
  await expectStackState(page, true, false)
})

test('Cmd+Z w trakcie edycji komórki należy do inputa, a po jej zakończeniu — do stosu', async ({
  page,
}) => {
  await openEditor(page, seed.boundary)
  await typeQty(page, 'Praca pierwsza', '99')

  // While text-editing, the shortcut undoes a character in the input, not an editor command — if it
  // reached the stack, a mid-typing Cmd+Z would revert the unrelated earlier change.
  const other = await qtyCell(page, 'Praca trzecia')
  // Select the cell, then type: dsg only enters edit mode under a keypress, and its active-cell
  // frame intercepts a direct click on the input.
  await other.click()
  await page.keyboard.type('5')
  await expect(other.locator('input')).toBeFocused()
  await page.keyboard.press('Meta+z')
  await expectQty(page, 'Praca pierwsza', '99')

  await page.keyboard.press('Escape')
  const settled = serverAction(page)
  await page.keyboard.press('Meta+z')
  await settled
  await expectQty(page, 'Praca pierwsza', SEEDED_QTY['Praca pierwsza'])
})

test('cofnięcie przesunięcia wiersza przywraca display_order po przeładowaniu', async ({
  page,
}) => {
  await openEditor(page, seed.reorder)
  const seededOrder = ['Praca pierwsza', 'Praca druga', 'Praca trzecia']
  await expect.poll(() => itemOrder(page)).toEqual(seededOrder)

  const settled = serverAction(page)
  await page
    .locator('.dsg-row')
    .filter({ hasText: 'Praca pierwsza' })
    .getByRole('button', { name: 'Akcje wiersza' })
    .click()
  await page.getByRole('menuitem', { name: 'Przesuń w dół', exact: true }).click()
  await settled
  await expect
    .poll(() => itemOrder(page))
    .toEqual(['Praca druga', 'Praca pierwsza', 'Praca trzecia'])

  await runStackCommand(page, UNDO)
  await expect.poll(() => itemOrder(page)).toEqual(seededOrder)

  await page.reload()
  await expect.poll(() => itemOrder(page)).toEqual(seededOrder)
})

// „Opis prac" rests as a text node (its textarea mounts only while editing); section/„Razem" rows
// have no matching name and drop out on their own.
async function itemOrder(page: Page): Promise<string[]> {
  const names = Object.keys(SEEDED_QTY)
  const texts = await page.locator('.dsg-row').allTextContents()
  return texts
    .map((text) => names.find((name) => text.includes(name)))
    .filter((name): name is string => name !== undefined)
}
