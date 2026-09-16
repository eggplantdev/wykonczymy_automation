import { test, expect, type Locator, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { openEditor, refreshReferenceData, rowCell, runSeedScript } from './helpers'

// EX-525 (S-07) — cofnij/ponów w edytorze kosztorysu.
//
// The stack itself is unit-covered (`use-undo-redo.test.ts`), and repeating „push, pop, pointer
// moves" here would prove nothing new. Three things it cannot see live only in a browser:
//
//   • an undo is a WRITE. The grid reverts its own `useState` first and the server action follows,
//     so „the old value is back on screen" is exactly what a revert that never reached Postgres
//     looks like — only a reload separates them.
//   • a run of keystrokes is one command, not one per character (`UNDO_COALESCE_MS`), and nothing
//     below the browser produces a real keystroke burst.
//   • the Cmd+Z boundary, which `use-undo-keyboard.ts` itself flags as a heuristic needing browser
//     verification: while a cell is in text-edit the key belongs to the input, and only after the
//     edit ends may it drive our stack. Both halves of that are asserted here.
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

// A server action reply carries `next-action` on its POST, and it is the only observable end of one
// (`networkidle` never settles in this app). An undo is a write like any edit, so a reload fired
// before the reply would read the value the revert was about to replace.
function serverAction(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.request().headers()['next-action'] !== undefined,
  )
}

const qtyCell = (page: Page, row: string): Promise<Locator> => rowCell(page, row, QTY_COLUMN)

// Type a value into a przedmiar cell the way the grid is used: the cell renders an
// `EditableCellInput`, so the figure lives in `value` and never in a text node.
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

// Radix chowa tło pod otwartym menu (`aria-hidden`), więc dopóki poprzednie się nie zwinie, samego
// przycisku „Opcje" nie widać — czekanie na jego zamknięcie należy do otwierania, nie do domysłu.
async function openOptionsMenu(page: Page): Promise<void> {
  await expect(optionsMenu(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Opcje', exact: true }).click()
  await expect(optionsMenu(page)).toBeVisible()
}

async function closeOptionsMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(optionsMenu(page)).toHaveCount(0)
}

// „Cofnij" / „Ponów" through the „Opcje" menu — the entry a mouse reaches, and the one whose
// disabled state is the only thing on screen telling how deep the stack is.
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

  // Siatka trzyma własny `rows` w stanie, więc dopiero przeładowanie odpowiada, czy cofnięcie
  // dojechało do Postgresa. Ono też kasuje stos — dlatego ponowienie ma poniżej własną edycję.
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
  // Pasek narzędzi montuje się razem z siatką, więc pytanie o stos zadane przed pierwszym odczytem
  // wiersza trafia czasem w moment, gdy „Opcji" jeszcze nie ma.
  await expectQty(page, 'Praca pierwsza', SEEDED_QTY['Praca pierwsza'])
  await expectStackState(page, false, false)

  // Znak po znaku, nie `fill`: zlepianie serii w jedną komendę (UNDO_COALESCE_MS) jest widoczne
  // wyłącznie wtedy, gdy każdy znak jest osobnym `onChange` — `fill` wysyła jedno zdarzenie i
  // przeszedłby nawet bez zlepiania.
  const cell = await qtyCell(page, 'Praca pierwsza')
  await cell.click()
  const settled = serverAction(page)
  // Enter, nie pierwszy znak serii: wejście w edycję pod znakiem jest wyścigiem — zanim input
  // przejmie fokus, kolejne znaki lecą jeszcze do siatki i przepadają. Enter otwiera edytor bez
  // wpisywania czegokolwiek, więc cała seria zaczyna się już w inpucie. Odstęp jest krótszy niż
  // UNDO_COALESCE_MS, żeby wszystkie znaki wpadły do jednego bufora.
  await page.keyboard.press('Enter')
  await expect(cell.locator('input')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('1234', { delay: 80 })
  await expect(cell.locator('input')).toHaveValue('1234')
  await page.keyboard.press('Enter')
  await settled
  await expectQty(page, 'Praca pierwsza', '1234')

  // Bufor zamyka się dopiero po przerwie w pisaniu, więc jedno cofnięcie przed jej upływem cofnęłoby
  // pustą serię.
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

  // Kursor w komórce obok: dopóki trwa edycja tekstu, skrót jest cofnięciem znaku w inpucie, a nie
  // komendą edytora — gdyby sięgał stosu, jedno Cmd+Z w środku pisania wywracałoby poprzednią,
  // niezwiązaną zmianę.
  const other = await qtyCell(page, 'Praca trzecia')
  // Zaznaczenie komórki, a potem znak — dsg wchodzi w edycję dopiero pod klawiszem, a jego ramka
  // aktywnej komórki przechwytuje kliknięcie w sam input.
  await other.click()
  await page.keyboard.type('5')
  await expect(other.locator('input')).toBeFocused()
  await page.keyboard.press('Meta+z')
  await expectQty(page, 'Praca pierwsza', '99')

  // Po wyjściu z edycji ten sam skrót prowadzi już do stosu.
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

// The prace on screen, in row order — „Opis prac" rests as a text node (its textarea mounts only
// while editing), and the section band and „Razem" rows carry none of these names.
async function itemOrder(page: Page): Promise<string[]> {
  const names = Object.keys(SEEDED_QTY)
  const texts = await page.locator('.dsg-row').allTextContents()
  return texts
    .map((text) => names.find((name) => text.includes(name)))
    .filter((name): name is string => name !== undefined)
}
