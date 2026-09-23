import { test, expect, type Page } from '@playwright/test'
import { type ReconSeedT, seedReconInvestments } from './seeds'
import {
  LOAD_VERSION_ITEM,
  openEditor,
  pickKosztorysOption as pickOption,
  versionsDrawer,
} from './drivers/kosztorys-grid'

// „Wersje" — the editor's restore points, and the one action that needs them: „Wyczyść kosztorys…".
//
// EX-719 (wyczyszczenie + powrót) and EX-428 (szuflada „Wersje" + przywrócenie) are one surface, so
// they are one file: both drive the same drawer, and a split would seed the same fixture twice.
//
// The server half is already covered below the browser — `replaceTreeWithSnapshot` takes the forced
// labelled snapshot inside the same transaction as the wipe, and the restore specs prove the tree
// comes back. What none of them reach is the round trip a person actually makes: the clear dialog
// counts what is about to die off the RENDERED tree, the wipe has to repaint the grid it just
// emptied without a page load, the drawer fetches its own list (it opens programmatically, which is
// how it once got stuck on „Wczytywanie…"), and the restored rozpiska has to come back into the
// same editor. A wipe that persists while the grid keeps showing the old rows is the failure this
// buys: the owner clears, sees the rozpiska, assumes it failed, and clears again.
test.use({ storageState: 'e2e/.auth/user.json' })

let seed: ReconSeedT

// Seeded rather than borrowed from the dump, because this spec's whole subject is deleting the
// rozpiska: a dump investment would be handed to the next spec empty if the restore leg ever broke.
// The fixture is deliberately tiny — one sekcja, one praca — so the wipe and the restore are two
// round trips instead of six hundred, and so the dialog's counts are nameable. The seed makes two
// investments and the tests take one each, so neither inherits the other's versions.
test.beforeAll(async ({ browser }) => {
  seed = await seedReconInvestments(browser)
})

// Matched on the explanation, not the label — see LOAD_VERSION_ITEM in drivers/kosztorys-grid for why.
const CLEAR_ITEM = /Usuwa całą rozpiskę/
const SAVE_VERSION_ITEM = /Zapisz bieżący stan jako nazwany punkt/

// „Pozycja 1" is the seeded praca's description; its presence in the grid is the whole of „the
// rozpiska is there". Asserted as a count so the absence leg reads as the same fact, negated.
const seededItem = (page: Page) => page.getByText('Pozycja 1', { exact: true })

test('clearing a kosztorys empties the grid on the spot and leaves one version it comes back from', async ({
  page,
}) => {
  await openEditor(page, seed.match)
  await expect(seededItem(page).first()).toBeVisible()

  await pickOption(page, CLEAR_ITEM)

  // The counts come from the tree the editor is holding, which is why they belong in a browser at
  // all: this sentence is the owner's last chance to notice the dialog is talking about a different
  // rozpiska than the one on screen.
  const clearDialog = page.getByRole('dialog').filter({ hasText: 'Wyczyść kosztorys' })
  await expect(clearDialog).toContainText('1 sekcja')
  await expect(clearDialog).toContainText('1 praca')
  await clearDialog.getByRole('button', { name: 'Wyczyść', exact: true }).click()

  // No reload between the write and this read — the grid has to learn of its own wipe.
  await expect(page.getByText('Kosztorys jest pusty')).toBeVisible({ timeout: 90_000 })
  await expect(seededItem(page)).toHaveCount(0)

  // And it was a write, not a repaint: the empty rozpiska survives a fresh load of the page.
  await page.reload()
  await expect(page.getByText('Kosztorys jest pusty')).toBeVisible({ timeout: 90_000 })

  // Clearing an already-empty rozpiska would push an empty restore point into „Wersje" on top of
  // the real one — so the confirm is refused while the dialog still opens and explains itself.
  await pickOption(page, CLEAR_ITEM)
  await expect(clearDialog.getByRole('button', { name: 'Wyczyść', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')

  await pickOption(page, LOAD_VERSION_ITEM)

  const versions = versionsDrawer(page)
  await expect(versions.getByText('Przed wyczyszczeniem')).toBeVisible()
  // Exactly one restore point: this investment was created by the seed in this run and edited by
  // nothing since, so the wipe is the only thing that can have left a version behind. A second row
  // here would mean the wipe ran twice — which is precisely what the disabled confirm above guards.
  const restore = versions.getByRole('button', { name: 'Przywróć' })
  await expect(restore).toHaveCount(1)
  await restore.click()

  const confirm = page.getByRole('alertdialog')
  // The restore is not a clean round trip and says so: the rabat globalny the wipe zeroed stays
  // zeroed. Promising otherwise is the version of this bug that costs money.
  await expect(confirm).toContainText('rabat globalny')
  await confirm.getByRole('button', { name: 'Przywróć' }).click()

  // Back into the same editor, again with no reload of our own.
  await expect(seededItem(page).first()).toBeVisible({ timeout: 90_000 })
  await page.reload()
  await expect(seededItem(page).first()).toBeVisible()
})

test('a named version is listed as one, and restoring it leaves a way back from the restore', async ({
  page,
}) => {
  const label = `E2E wersja ${Date.now()}`
  await openEditor(page, seed.mismatch)
  await expect(seededItem(page).first()).toBeVisible()

  await pickOption(page, SAVE_VERSION_ITEM)
  const saveDialog = page.getByRole('dialog').filter({ hasText: 'Zapisz wersję' })
  await saveDialog.getByPlaceholder('Nazwa wersji').fill(label)
  await saveDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(saveDialog).toBeHidden()

  await pickOption(page, LOAD_VERSION_ITEM)

  // The drawer is opened programmatically and fetches its list on open — it once stayed on
  // „Wczytywanie…" forever, which is a failure no server test can see. A named row rendering IS the
  // fetch having landed.
  const versions = versionsDrawer(page)
  await expect(versions.getByText(label)).toBeVisible()
  await expect(versions.getByText('Nazwane wersje')).toBeVisible()
  // Nothing has edited this investment since the seed created it, so the manual save is the only
  // restore point that can exist yet. That is what makes the „after" count below mean something.
  await expect(versions.getByText('Historia automatyczna')).toHaveCount(0)
  await expect(versions.getByRole('button', { name: 'Przywróć' })).toHaveCount(1)

  await versions.getByRole('button', { name: 'Przywróć' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Przywróć' }).click()
  await expect(seededItem(page).first()).toBeVisible({ timeout: 90_000 })

  // A mis-restore has to be recoverable too, so the restore snapshots the state it overwrote —
  // ambient history, not a named version. Counted, because „the section appeared" would also pass
  // if the restore had written two.
  await pickOption(page, LOAD_VERSION_ITEM)
  await expect(versions.getByText('Historia automatyczna')).toBeVisible()
  await expect(versions.getByRole('button', { name: 'Przywróć' })).toHaveCount(2)
})
