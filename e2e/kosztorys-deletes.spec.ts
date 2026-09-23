import { test, expect, type Page } from '@playwright/test'
import { type DeleteSeedT, seedDeleteInvestments } from './support/seeds'
import { clickAndSettle } from './support/wait'
import {
  collapseSummaryPanel,
  expectCellValue,
  gridRow,
  LOAD_VERSION_ITEM,
  openEditor,
  pickKosztorysOption,
  rowCell,
  versionsDrawer,
} from './drivers/kosztorys-grid'

// EX-520 — deleting a pozycja, a sekcja or an etap that already carries wpisane ilości.
//
// The policy itself reversed once (EX-477): what used to be refused is now allowed behind a confirm,
// with a forced snapshot taken first. That half is settled below the browser — the delete-guard DB
// spec runs the real actions and asserts the rows are gone and the snapshot is there, for both the
// populated and the plan-only case. Repeating it here would only prove it slower.
//
// What no test below the browser reaches is the wiring in between, and it is where this feature
// actually fails: whether the confirm GATES the removal (a dialog whose „Anuluj" deletes anyway is a
// data-loss bug no unit test can see), whether the real DynamicDataSheetGrid re-renders the cascade
// out — a sekcja takes its prace with it, an etap takes its column and every quantity in it — and
// whether the snapshot the action took is reachable from the drawer the owner would actually open.
// The grid is seeded into `useState` at mount, so „the row is gone after a reload" and „the row is
// gone now" are two different facts; both are asserted, in that order, every time.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: DeleteSeedT

// One investment per test — see seedDeleteInvestments. Each rozpiska is two sekcje (alfa: two prace,
// beta: one) across two etapy, every praca carrying progress on both.
test.beforeAll(async ({ browser }) => {
  seed = await seedDeleteInvestments(browser)
})

// By the rename input's value, not by text: the band's name lives in that input and nowhere else,
// so a `hasText` filter matches no band at all.
const band = (page: Page, sectionName: string) =>
  page
    .locator('.dsg-row.kosztorys-section-header')
    .filter({ has: page.locator(`input[value="${sectionName}"]`) })

// Anchored: „Etap 2" is also the prefix of the „Etap 2 netto" wartość column standing beside it.
const headerCell = (page: Page, text: string) =>
  page.locator('.dsg-row.dsg-row-header .dsg-cell').filter({ hasText: new RegExp(`^${text}$`) })

// The confirm every one of these deletes goes through. Not scoped to a title: the point of the
// assertions below is which title came up, so the locator must not presuppose it.
const confirm = (page: Page) => page.getByRole('alertdialog')

test('deleting a populated pozycja asks first, and the version it leaves behind brings it back', async ({
  page,
}) => {
  await openEditor(page, seed.item)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)

  await gridRow(page, 'Praca alfa jeden').getByRole('button', { name: 'Akcje wiersza' }).click()
  await page.getByRole('menuitem', { name: 'Usuń pozycję' }).click()

  // The dialog says what else goes with the praca. The wpisane ilości are the part a person does not
  // picture when they delete a row, and they are the part in-editor undo cannot bring back.
  await expect(confirm(page)).toContainText('Usunąć pozycję?')
  await expect(confirm(page)).toContainText('wpisane ilości etapów')

  // „Anuluj" has to be a real gate, not a dialog painted over a removal that already happened.
  await confirm(page).getByRole('button', { name: 'Anuluj' }).click()
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)
  await page.reload()
  await collapseSummaryPanel(page)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1)

  await gridRow(page, 'Praca alfa jeden').getByRole('button', { name: 'Akcje wiersza' }).click()
  await page.getByRole('menuitem', { name: 'Usuń pozycję' }).click()
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  // Gone from the grid with no reload of ours, and ONLY it: its sekcja and its neighbour stay, which
  // is what separates „the row was removed" from „the view collapsed".
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(0)
  await expect(gridRow(page, 'Praca alfa dwa')).toHaveCount(1)
  await expect(band(page, 'Sekcja alfa')).toHaveCount(1)

  await page.reload()
  await collapseSummaryPanel(page)
  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(0)

  // The recoverability the confirm implicitly promises. Nothing has edited this investment since the
  // seed created it, so the delete is the only thing that can have left a restore point — counted,
  // because „a version exists" would also pass on a snapshot taken by something else.
  await pickKosztorysOption(page, LOAD_VERSION_ITEM)
  const versions = versionsDrawer(page)
  await expect(versions.getByText('Historia automatyczna')).toBeVisible()
  const restore = versions.getByRole('button', { name: 'Przywróć' })
  await expect(restore).toHaveCount(1)
  await restore.click()
  await confirm(page).getByRole('button', { name: 'Przywróć' }).click()

  await expect(gridRow(page, 'Praca alfa jeden')).toHaveCount(1, { timeout: 20_000 })
})

test('deleting a populated sekcja takes its prace with it and leaves the other sekcja standing', async ({
  page,
}) => {
  await openEditor(page, seed.section)
  await expect(band(page, 'Sekcja beta')).toHaveCount(1)

  await band(page, 'Sekcja beta').getByRole('button', { name: 'Akcje sekcji' }).click()
  await page.getByRole('menuitem', { name: 'Usuń sekcję' }).click()

  // The title names the sekcja and counts what is inside it — off the rendered tree, so it is also
  // the owner's check that the „…" they hit belonged to the band they meant.
  await expect(confirm(page)).toContainText('Sekcja beta')
  await expect(confirm(page)).toContainText('(1 poz.)')
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  // The cascade, repainted by the real grid: band and praca both gone, sekcja alfa untouched.
  await expect(band(page, 'Sekcja beta')).toHaveCount(0)
  await expect(gridRow(page, 'Praca beta jeden')).toHaveCount(0)
  await expect(band(page, 'Sekcja alfa')).toHaveCount(1)
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

  // The trigger IS the header label — its accessible name is „Etap 2", not its title attribute — so
  // it is reached through the header cell rather than by a name of its own.
  await headerCell(page, 'Etap 2').getByRole('button').first().click()
  await page.getByRole('menuitem', { name: 'Usuń etap' }).click()

  await expect(confirm(page)).toContainText('Usunąć „Etap 2"?')
  await clickAndSettle(confirm(page).getByRole('button', { name: 'Usuń' }))

  // An etap is a COLUMN, so its removal re-lays out every row at once — the one delete here that no
  // row-level assertion could catch. „Etap 1" keeping its ilość is what makes this a column drop
  // rather than the whole stage block failing to render.
  await expect(headerCell(page, 'Etap 2')).toHaveCount(0)
  await expect(headerCell(page, 'Etap 1')).toHaveCount(1)
  await expectCellValue(await rowCell(page, 'Praca alfa jeden', 'Etap 1'), '2')

  await page.reload()
  await collapseSummaryPanel(page)
  await expect(headerCell(page, 'Etap 2')).toHaveCount(0)
  await expect(headerCell(page, 'Etap 1')).toHaveCount(1)
})
