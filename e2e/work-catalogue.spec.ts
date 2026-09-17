import { test, expect, type Locator, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import {
  collapseSummaryPanel,
  expectMoney,
  gridRow,
  openEditor,
  rowCell,
  waitForHydration,
  seedCatalogueInvestments,
  tableCell,
  type CatalogueSeedT,
} from './helpers'

// EX-756 — katalog prac: saving a pozycja out of a rozpiska and inserting a praca from the katalog.
//
// Almost every risk this issue names already has a cheaper guard. The save's own branches (nowa
// pozycja vs nadpisanie, „Zostaw kategorię z katalogu", the refusal of a praca bez j.m.) run against
// the real DB in `work-catalogue-save.test.ts`; identity and the UNIQUE klucz in
// `work-catalogue.test.ts`; „dopisuje na koniec sekcji" in `work-catalogue-insert.test.ts`; and the
// pure folding, comparison and „jest już w kosztorysie" rules each have their own unit spec.
//
// Two things stay browser-only, and they are the two that would lose the owner something real:
//
//   1. The „Zapisz do katalogu…" dialog decides between CREATE and OVERWRITE from the klucz alone,
//      and the overwrite is irreversible — the katalog keeps no history. So the numbers it shows must
//      come from the server (they do: `catalogueSavePreviewAction`, the same derivation the save
//      runs), the confirm must be a real gate rather than chrome painted over a write that already
//      happened, and the second save on the same klucz must replace the row instead of adding one.
//      Nothing below the browser holds that chain: dialog → akcja → Postgres → tag → /katalog-prac.
//   2. The praca picked out of the katalog has to land at the end of the sekcja it was opened FROM,
//      inside the real dsg virtualizer. `appendCatalogueItems` is unit-covered against MAX(display_order),
//      but which sekcja that id belonged to, and whether the grid paints the new row into the right
//      band without a reload, is a question only the rendered grid answers.
//
// Both tests write to the katalog through the UI rather than seeding rows: the cennik is one
// argument-free `unstable_cache` entry living in the Next server, and only its own server action
// invalidates it — a row written by the seed subprocess would simply not be there for the picker.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: CatalogueSeedT

test.beforeAll(async ({ browser }) => {
  seed = await seedCatalogueInvestments(browser)
})

// Seeded: przedmiar 10 at 100 zł on every praca, two sekcje — see seed-work-catalogue.ts.
const SEEDED_PRICE = 100
const RAISED_PRICE = 150

const PRICE_COLUMN = COLUMN_LABELS.price
const CATALOGUE_PRICE_COLUMN = 'Cena j.m.'

async function openSaveDialog(page: Page, description: string): Promise<Locator> {
  await gridRow(page, description).getByRole('button', { name: 'Akcje wiersza' }).click()
  await page.getByRole('menuitem', { name: 'Zapisz pozycję do katalogu prac' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Zapisz do katalogu')
  return dialog
}

// /katalog-prac narrowed to one opis. The cennik is global and ~950 rows deep, so the search box is
// both the fast read and the honest one: „exactly one row" is a statement about the whole katalog.
async function findInCatalogue(page: Page, description: string): Promise<void> {
  await page.goto('/katalog-prac')
  const search = page.getByPlaceholder('Szukaj pracy')
  await search.waitFor()
  // A value filled into an input React has not claimed yet sits in the DOM and filters nothing —
  // the whole katalog then reads as „this klucz is not unique".
  await waitForHydration(search)
  await search.fill(description)
  await expect(search).toHaveValue(description)
  // The list is filtered behind `useDeferredValue`, so ~950 rows redraw before the count settles.
  await expect(page.locator('table tbody tr'), 'wierszy w katalogu pod tym kluczem').toHaveCount(
    1,
    {
      timeout: 30_000,
    },
  )
}

test('zapis pozycji do katalogu: druga próba nadpisuje ten sam wiersz, po potwierdzeniu', async ({
  page,
}) => {
  // Two editor renders, two dialogs and three /katalog-prac reads.
  test.slow()

  await openEditor(page, seed.save.id)

  // --- pierwszy zapis: nowa pozycja ---
  const dialog = await openSaveDialog(page, seed.save.item)
  // „Do zapisania", never „Po zapisie": a free klucz has no second side to compare against, and the
  // label is what tells the owner he is not about to lose anything.
  await expect(dialog).toContainText('Do zapisania')
  await expect(dialog).not.toContainText('W katalogu')
  await expectMoney(dialog, SEEDED_PRICE, 'cena z podglądu serwera')
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(page.getByText('Dodano do katalogu')).toBeVisible()

  await findInCatalogue(page, seed.save.item)
  await expectMoney(
    await tableCell(page, seed.save.item, CATALOGUE_PRICE_COLUMN),
    SEEDED_PRICE,
    'cena zapisana w katalogu',
  )

  // --- raise the price in the rozpiska, save the same klucz once more ---
  await openEditor(page, seed.save.id)
  const priceCell = await rowCell(page, seed.save.item, PRICE_COLUMN)
  await priceCell.click()
  await priceCell.locator('input').fill(String(RAISED_PRICE))
  await page.keyboard.press('Enter')
  // The dialog reads its figures from the server by the pozycja's id, so the new cena has to be IN
  // Postgres before it opens — the reload is what proves it got there.
  await page.reload()
  await collapseSummaryPanel(page)

  const overwrite = await openSaveDialog(page, seed.save.item)
  // The klucz is occupied, so this is a replacement — and the dialog says so before anything
  // is clicked.
  await expect(overwrite).toContainText('W katalogu')
  await expect(overwrite).toContainText('Po zapisie')
  await expectMoney(overwrite, SEEDED_PRICE, 'stara cena z katalogu')
  await expectMoney(overwrite, RAISED_PRICE, 'nowa cena z rozpiski')
  await overwrite.getByRole('button', { name: 'Nadpisz…' }).click()

  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(`Nadpisać „${seed.save.item}"`)
  await expectMoney(confirm, SEEDED_PRICE, 'kwota „przed" w potwierdzeniu')
  await expectMoney(confirm, RAISED_PRICE, 'kwota „po" w potwierdzeniu')

  // „Anuluj" has to be a real gate: the katalog keeps no history, so a dialog painted over a write
  // that already happened would destroy the old stawka with no way back.
  await confirm.getByRole('button', { name: 'Anuluj' }).click()
  await findInCatalogue(page, seed.save.item)
  await expectMoney(
    await tableCell(page, seed.save.item, CATALOGUE_PRICE_COLUMN),
    SEEDED_PRICE,
    'cena po anulowaniu nadpisania',
  )

  await openEditor(page, seed.save.id)
  const again = await openSaveDialog(page, seed.save.item)
  await again.getByRole('button', { name: 'Nadpisz…' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Nadpisz', exact: true }).click()
  await expect(page.getByText('Nadpisano pozycję katalogu')).toBeVisible()

  // Still ONE row — that is the whole point of the klucz. A second row under the same opis and j.m.
  // would make every future kosztorys copy one of two prices for the same praca, at random.
  await findInCatalogue(page, seed.save.item)
  await expectMoney(
    await tableCell(page, seed.save.item, CATALOGUE_PRICE_COLUMN),
    RAISED_PRICE,
    'cena po nadpisaniu',
  )
})

// Every grid row in render order. Section bands and the „Razem" footer ride the grid as ordinary
// `.dsg-row`s, which is exactly what makes this readable as an order: the band IS a row, so „behind
// the band" and „in front of the next one" are index comparisons.
async function rowOrder(page: Page): Promise<string[]> {
  const rows = page.locator('.dsg-row')
  await rows.first().waitFor()
  // Text AND the inputs' values: a band's name is only ever in its rename input, so a band read by
  // `textContent` alone carries the item count and not the sekcja it belongs to.
  return rows.evaluateAll((nodes) =>
    nodes.map((node) =>
      [
        node.textContent ?? '',
        ...Array.from(node.querySelectorAll('input')).map((input) => input.value),
      ].join(' '),
    ),
  )
}

const occurrences = (rows: string[], needle: string) =>
  rows.flatMap((text, index) => (text.includes(needle) ? [index] : []))

// The inserted praca sits behind the whole of „Sekcja beta" and behind its one existing praca. Read
// off one snapshot of the grid rather than three locators, so the three facts cannot disagree about
// which render they are describing.
async function expectLandedAtEndOfBeta(page: Page, item: string, beta: string): Promise<void> {
  const rows = await rowOrder(page)
  const copies = occurrences(rows, item)
  expect(copies, 'kopii wstawionej pracy w rozpisce').toHaveLength(2)
  const [band] = occurrences(rows, 'Sekcja beta')
  const [existing] = occurrences(rows, beta)
  expect(copies[1], 'wstawiona praca przed nagłówkiem „Sekcja beta"').toBeGreaterThan(band)
  expect(copies[1], 'wstawiona praca przed pracami, które już tam były').toBeGreaterThan(existing)
}

test('praca z katalogu ląduje na końcu tej sekcji, z której otwarto katalog', async ({ page }) => {
  test.slow()

  await openEditor(page, seed.insert.id)

  // Setup through the UI rather than the seed: only the save action invalidates the katalog cache
  // that the picker below reads from.
  const dialog = await openSaveDialog(page, seed.insert.item)
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(page.getByText('Dodano do katalogu')).toBeVisible()

  await page
    .locator('.dsg-row.kosztorys-section-header')
    .filter({ has: page.locator('input[value="Sekcja beta"]') })
    .getByRole('button', { name: 'Akcje sekcji' })
    .click()
  await page.getByRole('menuitem', { name: 'Dodaj pracę z katalogu do sekcji…' }).click()

  const picker = page.getByRole('dialog')
  await expect(picker).toContainText('Dodaj pracę z katalogu')
  const row = picker.getByRole('checkbox', { name: seed.insert.item, exact: true })

  // Instrument check, and the one behaviour the picker owns: the praca IS in this kosztorys, so the
  // switch hides it. Without this, ticking it below would prove nothing about what the switch does
  // — and „nie znalazłem wiersza" would look the same as „katalog się nie wczytał".
  await expect(row, 'praca już w rozpisce, a mimo to widoczna').toHaveCount(0)
  await picker
    .locator('label')
    .filter({ hasText: 'Ukryj już dodane' })
    .getByRole('checkbox')
    .click()
  await row.click()

  await picker.getByRole('button', { name: 'Dodaj (1)' }).click()
  await expect(page.getByText('Dodano pracę')).toBeVisible()

  // First without a reload: the grid patches itself from the action's answer, and the band it draws
  // the row into is the claim under test.
  await collapseSummaryPanel(page)
  await expectLandedAtEndOfBeta(page, seed.insert.item, seed.insert.beta)

  // The grid seeds its rows into `useState` at mount, so „it is on screen" and „it is in Postgres" are
  // two different facts — only the reload answers the second, display_order included.
  await page.reload()
  await collapseSummaryPanel(page)
  await expectLandedAtEndOfBeta(page, seed.insert.item, seed.insert.beta)
})
