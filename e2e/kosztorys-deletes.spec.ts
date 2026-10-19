import { test, expect, type Page } from '@playwright/test'
import { type E2ESeedsT, readSeed } from './support/seeds'
import { clickAndSettle } from './support/wait'
import {
  collapseSummaryPanel,
  expectCellValue,
  GRID_VIEWPORT,
  gridRow,
  LOAD_VERSION_ITEM,
  openEditor,
  openRowMenu,
  openSectionMenu,
  pickKosztorysOption,
  rowCell,
  sectionBand,
  versionsDrawer,
} from './drivers/kosztorys-grid'

test.use({ viewport: GRID_VIEWPORT })

// The grid is seeded into `useState` at mount, so „the row is gone after a reload" and „the row is
// gone now" are two different facts.
let seed: E2ESeedsT['deletes']

test.beforeAll(() => {
  seed = readSeed('deletes')
})

// Anchored: „Etap 2" is also the prefix of the „Etap 2 netto" wartość column standing beside it.
const headerCell = (page: Page, text: string) =>
  page.locator('.dsg-row.dsg-row-header .dsg-cell').filter({ hasText: new RegExp(`^${text}$`) })

const confirm = (page: Page) => page.getByRole('alertdialog')

test('deleting a populated pozycja asks first, and the version it leaves behind brings it back', async ({
  page,
}) => {
  await openEditor(page, seed.item)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)

  await openRowMenu(page, 'Praca alfa jeden')
  await page.getByRole('menuitem', { name: 'Usuń pozycję' }).click()

  await expect(confirm(page)).toContainText('Usunąć pozycję?')
  await expect(confirm(page)).toContainText('wpisane ilości etapów')

  await confirm(page).getByRole('button', { name: 'Anuluj' }).click()
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)
  await page.reload()
  await collapseSummaryPanel(page)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)

  await openRowMenu(page, 'Praca alfa jeden')
  await page.getByRole('menuitem', { name: 'Usuń pozycję' }).click()
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(0)
  await expect(gridRow(page, 'Praca alfa dwa')).toHaveCount(1)
  await expect(sectionBand(page, 'Sekcja alfa')).toHaveCount(1)

  await page.reload()
  await collapseSummaryPanel(page)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(0)

  // Nothing has edited this investment since the seed created it, so the delete is the only thing that can have left a restore point.
  await pickKosztorysOption(page, LOAD_VERSION_ITEM)
  const versions = versionsDrawer(page)
  await expect(versions.getByText('Historia automatyczna')).toBeVisible()
  const restore = versions.getByRole('button', { name: 'Przywróć' })
  await expect(restore).toHaveCount(1)
  await restore.click()
  await confirm(page).getByRole('button', { name: 'Przywróć' }).click()

  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)
})

test('deleting a populated sekcja takes its prace with it and leaves the other sekcja standing', async ({
  page,
}) => {
  await openEditor(page, seed.section)
  await expect(sectionBand(page, 'Sekcja beta')).toHaveCount(1)

  await openSectionMenu(page, 'Sekcja beta')
  await page.getByRole('menuitem', { name: 'Usuń sekcję' }).click()

  await expect(confirm(page)).toContainText('Sekcja beta')
  await expect(confirm(page)).toContainText('(1 poz.)')
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  await expect(sectionBand(page, 'Sekcja beta')).toHaveCount(0)
  await expect(gridRow(page, 'Praca beta jeden')).toHaveCount(0)
  await expect(sectionBand(page, 'Sekcja alfa')).toHaveCount(1)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)
  await expect(gridRow(page, 'Praca alfa dwa')).toHaveCount(1)

  await page.reload()
  await collapseSummaryPanel(page)
  await expect(gridRow(page, 'Praca beta jeden')).toHaveCount(0)
  await expect(gridRow(page, 'Praca alfa dwa')).toHaveCount(1)
})

test('deleting a populated etap drops its column and the ilości in it, and only its own', async ({
  page,
}) => {
  await openEditor(page, seed.stage)
  await expect(headerCell(page, 'Etap 2')).toHaveCount(1)
  await expectCellValue(await rowCell(page, 'Praca alfa jeden', 'Etap 2'), '2')

  // The trigger IS the header label — its accessible name is „Etap 2", not its title attribute.
  await headerCell(page, 'Etap 2').getByRole('button').first().click()
  await page.getByRole('menuitem', { name: 'Usuń etap' }).click()

  await expect(confirm(page)).toContainText('Usunąć „Etap 2"?')
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  await expect(headerCell(page, 'Etap 2')).toHaveCount(0)
  await expect(headerCell(page, 'Etap 1')).toHaveCount(1)
  await expectCellValue(await rowCell(page, 'Praca alfa jeden', 'Etap 1'), '2')

  await page.reload()
  await collapseSummaryPanel(page)
  await expect(headerCell(page, 'Etap 2')).toHaveCount(0)
  await expect(headerCell(page, 'Etap 1')).toHaveCount(1)
})
