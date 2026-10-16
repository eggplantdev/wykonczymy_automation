import { test, expect, type Locator, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { type CatalogueSeedT, seedCatalogueInvestments } from './support/seeds'
import { expectMoney } from './support/money'
import { tableCell } from './support/table'
import { settleWrite, waitForHydration } from './support/wait'
import {
  collapseSummaryPanel,
  commitCellValue,
  gridRow,
  openEditor,
  rowCell,
} from './drivers/kosztorys-grid'

test.use({ storageState: 'e2e/.auth/user.json' })

let seed: CatalogueSeedT

test.beforeAll(async ({ browser }) => {
  seed = await seedCatalogueInvestments(browser)
})

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
  test.slow()

  await openEditor(page, seed.save.id)

  const dialog = await openSaveDialog(page, seed.save.item)
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

  await openEditor(page, seed.save.id)
  const priceCell = await rowCell(page, seed.save.item, PRICE_COLUMN)
  // The cell's autosave is debounced, so the reload below would abort it.
  await settleWrite(page, () => commitCellValue(priceCell, String(RAISED_PRICE)))
  await page.reload()
  await collapseSummaryPanel(page)

  const overwrite = await openSaveDialog(page, seed.save.item)
  await expect(overwrite).toContainText('W katalogu')
  await expect(overwrite).toContainText('Po zapisie')
  await expectMoney(overwrite, SEEDED_PRICE, 'stara cena z katalogu')
  await expectMoney(overwrite, RAISED_PRICE, 'nowa cena z rozpiski')
  await overwrite.getByRole('button', { name: 'Nadpisz…' }).click()

  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText(`Nadpisać „${seed.save.item}"`)
  await expectMoney(confirm, SEEDED_PRICE, 'kwota „przed" w potwierdzeniu')
  await expectMoney(confirm, RAISED_PRICE, 'kwota „po" w potwierdzeniu')

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

  await findInCatalogue(page, seed.save.item)
  await expectMoney(
    await tableCell(page, seed.save.item, CATALOGUE_PRICE_COLUMN),
    RAISED_PRICE,
    'cena po nadpisaniu',
  )
})

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

  // only the save action invalidates the katalog cache that the picker below reads from.
  const dialog = await openSaveDialog(page, seed.insert.item)
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(page.getByText('Dodano do katalogu')).toBeVisible()

  await page
    .locator('.dsg-row.kosztorys-section-header')
    .filter({ has: page.locator('input[value="Sekcja beta"]') })
    .getByRole('button', { name: 'Akcje sekcji' })
    .click()
  await page.getByRole('menuitem', { name: 'Dodaj pracę do sekcji…' }).click()

  const picker = page.getByRole('dialog')
  await expect(picker.getByRole('heading', { name: 'Dodaj pracę', exact: true })).toBeVisible()
  // The list is virtualized, so a row outside its window is missing from the DOM too — the check
  // below would pass for that alone. Narrowed to this one praca, only the switch can hide it.
  await picker.getByPlaceholder('Szukaj pracy…').fill(seed.insert.item)
  const row = picker.getByRole('checkbox', { name: seed.insert.item, exact: true })

  await expect(row, 'praca już w rozpisce, a mimo to widoczna').toHaveCount(0)
  await picker
    .locator('label')
    .filter({ hasText: 'Ukryj już dodane' })
    .getByRole('checkbox')
    .click()
  await row.click()

  await picker.getByRole('button', { name: 'Dodaj (1)' }).click()
  await expect(page.getByText('Dodano pracę')).toBeVisible()

  await collapseSummaryPanel(page)
  await expectLandedAtEndOfBeta(page, seed.insert.item, seed.insert.beta)

  await page.reload()
  await collapseSummaryPanel(page)
  await expectLandedAtEndOfBeta(page, seed.insert.item, seed.insert.beta)
})
