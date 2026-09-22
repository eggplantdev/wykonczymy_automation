import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import {
  collapseSummaryPanel,
  discountModeSelect,
  expandSummaryPanel,
  applyDiscountValue,
  gridRow,
  LOAD_VERSION_ITEM,
  openEditor,
  openSettlementOptions,
  pickDiscountMode,
  pickKosztorysOption,
  refreshReferenceData,
  rowCell,
  runSeedScript,
  versionsDrawer,
  waitForHydration,
} from './helpers'

// EX-442 (with EX-674 merged into it) — the szablon, end to end: cut one off a finished kosztorys,
// start a new investment from it, and drop one over a rozpiska that already exists.
//
// What lives below the browser is already covered: `kosztorys-presets.test.ts` runs the real actions
// and asserts the persisted tree, and `create-investment-preset.test.ts` guards the non-fatal seed on
// create. Repeating either here would only prove it slower.
//
// What no layer below reaches is the three seams this spec sits on:
//   • the duplicate-name refusal is a GATE — a dialog that toasts an error and closes anyway has
//     written nothing, and the DB spec would still pass;
//   • the create form's picker is a field that is not an investments column, stripped by the action
//     and turned into a whole tree — „the investment exists" says nothing about whether it did;
//   • „Wczytaj szablon…" DELETES the entire rozpiska and then has to repaint it without a reload
//     (the `remountKey` latch in kosztorys-editor-v2), while leaving behind a restore point that
//     brings back the etapy and the wykonanie the szablon does not carry.
//
// The tests run in order and share one szablon, because there is no other way to make one: a preset
// payload is written by `serializeKosztorysAsPreset`, which is `server-only` and out of reach of a
// seed script. Saving it through the dialog IS the first scenario, so the library the other two read
// is the one the app wrote — `mode: 'serial'` makes a failure there stop them rather than let them
// fail on its absence and hide the real cause.
test.use({ storageState: 'e2e/.auth/user.json' })
test.describe.configure({ mode: 'serial' })

type PresetSeedT = { source: number; reload: number }

let seed: PresetSeedT

// The szablon library is GLOBAL and the test DB is never reset, so the name has to be this run's own
// — otherwise the second run saves a duplicate of the first run's szablon and scenario 1 is testing
// the refusal it means to reach only by accident.
const presetName = `E2E Szablon ${Date.now()}`

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<PresetSeedT>('seed:kosztorys-presets', 'PRESET_SEED')
  await refreshReferenceData(browser)
})

// Both entries render their one-line explanation inside the item, so the accessible name carries it
// too — and „Zapisz"/„Wczytaj" alone match several rows of this menu.
const SAVE_PRESET_ITEM = /Zapisz jako wzór do użycia na innych inwestycjach/
const RELOAD_PRESET_ITEM = /Zastąp całą rozpiskę zapisanym szablonem/

const saveDialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Zapisz jako nowy szablon' })

const reloadDialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Wczytaj kosztorys z szablonu' })

// react-toastify keeps a success toast up for two seconds, so the NEXT assertion for the same text
// would be satisfied by the previous toast still on screen. Every wait here therefore also waits it
// back out, which is what makes two consecutive „Zapisano szablon" two separate facts.
async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.getByText(text)
  await expect(toast.first()).toBeVisible({ timeout: 20_000 })
  await expect(toast).toHaveCount(0, { timeout: 20_000 })
}

// „Dodaj" is the name of a button on EVERY row of this listing (the per-investment expense dialog),
// so the one that opens „Nowa inwestycja" has to be said by where it sits: the toolbar strip, which
// is identified by the search box it shares with it.
const listingToolbar = (page: Page) =>
  page
    .locator('div')
    .filter({ has: page.getByPlaceholder('Szukaj...') })
    .filter({ has: page.getByRole('button', { name: 'Dodaj', exact: true }) })
    .last()

// „Opcje rozliczenia" lives in the Podsumowanie panel's pinned bar, which stays MOUNTED but hidden
// while the panel is folded — so its trigger is there to be found and never clickable. Unfold, do the
// work, fold back: left open the panel covers every cell the rest of the test reads.
async function withSettlementOptions(page: Page, work: () => Promise<void>): Promise<void> {
  await expandSummaryPanel(page)
  await openSettlementOptions(page)
  await work()
  await page.keyboard.press('Escape')
  await collapseSummaryPanel(page)
}

// Create an investment through the real form — the only route that exercises the seed picker, which
// is a create-only field. Returns the new investment's id, read off the url its listing row opens,
// because nothing in the dialog reports it.
async function createInvestment(page: Page, name: string, preset?: string): Promise<number> {
  await page.goto('/inwestycje')
  const add = listingToolbar(page).getByRole('button', { name: 'Dodaj', exact: true })
  await waitForHydration(add)
  await add.click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Nowa inwestycja' })
  await dialog.getByLabel('Nazwa', { exact: true }).fill(name)
  if (preset) {
    await dialog.getByLabel('Kosztorys z szablonu').click()
    await page.getByRole('option', { name: preset, exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expectToast(page, 'Inwestycja dodana')

  // The listing is long and paginated; the name is this run's own, so the search box is what makes
  // one row of it.
  await page.getByPlaceholder('Szukaj...').fill(name)
  const row = page.locator('table tbody tr').filter({ hasText: name }).first()
  await row.waitFor()
  await waitForHydration(row)
  await row.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  return Number(new URL(page.url()).pathname.split('/').pop())
}

test('„Zapisz jako nowy szablon…" zapisuje wzór, odmawia zajętej nazwy i nadpisuje przez wybór z listy', async ({
  page,
}) => {
  await openEditor(page, seed.source)

  await pickKosztorysOption(page, SAVE_PRESET_ITEM)
  await saveDialog(page).getByPlaceholder('Nazwa szablonu').fill(presetName)
  await saveDialog(page).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expectToast(page, 'Zapisano szablon')
  await expect(saveDialog(page)).toHaveCount(0)

  // The same name again, still in „Nowy" — refused, and the refusal has to be a GATE. A dialog that
  // toasts and closes looks identical from the outside to one that saved, and the owner walks away
  // believing the second kosztorys is in the library.
  await pickKosztorysOption(page, SAVE_PRESET_ITEM)
  await saveDialog(page).getByPlaceholder('Nazwa szablonu').fill(presetName)
  await saveDialog(page).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expectToast(page, 'Szablon o tej nazwie już istnieje')
  await expect(saveDialog(page)).toBeVisible()

  // …and the way through is the other mode, where the name is PICKED rather than typed: the toggle
  // only renders once a szablon exists, so reaching it is also the proof the first save landed.
  await saveDialog(page).getByRole('radio', { name: 'Nadpisz istniejący' }).click()
  await expect(saveDialog(page).getByPlaceholder('Nazwa szablonu')).toHaveCount(0)
  await saveDialog(page).getByRole('combobox').click()
  await page.getByRole('option', { name: presetName, exact: true }).click()
  await saveDialog(page).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expectToast(page, 'Zapisano szablon')
  await expect(saveDialog(page)).toHaveCount(0)
})

test('nowa inwestycja z szablonu wstaje z rozpiską i wyzerowanym przedmiarem, a bez szablonu — pusta', async ({
  page,
}) => {
  const stamp = Date.now()
  const seeded = await createInvestment(page, `E2E Z szablonu ${stamp}`, presetName)

  await openEditor(page, seeded)
  // Both sekcje, not just the first: a seed that stopped at the opening band would still look right
  // against a one-section fixture.
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1)
  await expect(gridRow(page, 'Praca szablonowa dwa')).toHaveCount(1)
  await expect(gridRow(page, 'Praca pomocnicza')).toHaveCount(1)

  // The half that makes it a szablon rather than a copy. The source carries przedmiar 10 and two done
  // on „Etap 1"; both are this job's facts, so neither may cross — and the etap is gone as a COLUMN,
  // which is the one of the two that a row-level read could never report.
  // Read off the input's value, not the cell's text: „Przedmiar" is typed by hand, so its cell IS an
  // <input> and carries no text node at all.
  const przedmiar = await rowCell(page, 'Praca szablonowa jeden', COLUMN_LABELS.plannedQty)
  await expect(przedmiar.locator('input')).toHaveValue('0')
  await expect(
    page.locator('.dsg-row.dsg-row-header .dsg-cell').filter({ hasText: 'Etap 1' }),
  ).toHaveCount(0)

  // The other branch of the same field: left alone it means „— pusty kosztorys —", and an investment
  // that quietly inherited the last-used szablon is exactly the failure this pairs against.
  const empty = await createInvestment(page, `E2E Bez szablonu ${stamp}`)
  // Not `openEditor`: the Podsumowanie toggle stays DISABLED over an empty kosztorys, and that helper
  // waits for it to be enabled.
  await page.goto(`/inwestycje/${empty}/kosztorys_v2`)
  await expect(page.getByText('Kosztorys jest pusty')).toBeVisible({ timeout: 30_000 })
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(0)
})

test('„Wczytaj szablon…" zastępuje całą rozpiskę bez przeładowania, zeruje rabat i zostawia punkt powrotu', async ({
  page,
}) => {
  await openEditor(page, seed.reload)
  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(1)

  // A rabat kwotowy set BEFORE the load. A preset's przedmiar is all zeroes, so a surviving amount
  // discount would price the incoming rozpiska below nothing — the rabat is cleared by the reload,
  // and an unset one could not show that.
  await withSettlementOptions(page, async () => {
    await pickDiscountMode(page, 'Kwotowy')
    await applyDiscountValue(page, 500)
  })

  await pickKosztorysOption(page, RELOAD_PRESET_ITEM)
  // What the dialog promises, in the counted nouns the editor uses everywhere: one is what goes, the
  // other what arrives, and the owner is asked to weigh them against each other.
  await expect(reloadDialog(page)).toContainText('Zniknie: 1 sekcja · 1 praca')
  await reloadDialog(page).getByPlaceholder('Szukaj szablonu…').fill(presetName)
  await reloadDialog(page).getByRole('button', { name: presetName }).click()
  await expect(reloadDialog(page)).toContainText('Wejdzie: 2 sekcje · 3 prace')

  await reloadDialog(page).getByRole('button', { name: 'Wczytaj i zastąp', exact: true }).click()
  await expectToast(page, 'Wczytano: 2 sekcje · 3 prace')

  // With no reload of ours. The rozpiska was deleted server-side, so the grid — which seeds its rows
  // into `useState` at mount — is only correct here if the replacement remounted it; without that
  // latch it keeps rendering a tree that no longer exists in Postgres.
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1, { timeout: 20_000 })
  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(0)

  await openEditor(page, seed.reload)
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1)
  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(0)

  await withSettlementOptions(page, async () => {
    await expect(discountModeSelect(page)).toHaveText('Wyłączony')
  })

  // The way back. The label names the szablon because the restore points are otherwise
  // indistinguishable, and what returns is the part a szablon cannot carry: the etap and the
  // wykonanie recorded on it.
  await pickKosztorysOption(page, LOAD_VERSION_ITEM)
  const restorePoint = versionsDrawer(page)
    .locator('div')
    .filter({ hasText: `Przed wczytaniem: ${presetName}` })
    .filter({ has: page.getByRole('button', { name: 'Przywróć' }) })
    .last()
  await restorePoint.getByRole('button', { name: 'Przywróć' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Przywróć' }).click()

  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(1, { timeout: 20_000 })
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(0)
  // The wykonanie is what the szablon does NOT carry, so its return is the whole point of the restore
  // point. An etap quantity is typed by hand, i.e. an input — read the value, it has no text node.
  const restoredStage = await rowCell(page, 'Praca do zastąpienia', 'Etap 1')
  await expect(restoredStage.locator('input')).toHaveValue('2')
})
