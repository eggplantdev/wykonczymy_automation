import { test, expect, type Page } from '@playwright/test'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { waitForHydration } from './support/wait'
import {
  collapseSummaryPanel,
  expandSummaryPanel,
  gridRow,
  LOAD_VERSION_ITEM,
  openEditor,
  pickKosztorysOption,
  rowCell,
  versionsDrawer,
} from './drivers/kosztorys-grid'
import {
  applyDiscountAmount,
  discountModeSelect,
  openSettlementOptions,
  pickDiscountMode,
} from './drivers/settlement'

// The tests share one szablon: `mode: 'serial'` makes a failure there stop them rather than let them
// fail on its absence and hide the real cause.
test.use({ storageState: 'e2e/.auth/user.json' })
test.describe.configure({ mode: 'serial' })

type PresetSeedT = { source: number; reload: number }

let seed: PresetSeedT

// Szablon names are unique across the app and the test DB is never reset, so the name has to be this
// run's own — otherwise the second run saves a duplicate of the first run's szablon and scenario 1 is testing
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
// would be satisfied by the previous toast still on screen.
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
// while the panel is folded — so its trigger is there to be found and never clickable.
async function withSettlementOptions(page: Page, work: () => Promise<void>): Promise<void> {
  await expandSummaryPanel(page)
  await openSettlementOptions(page)
  await work()
  await page.keyboard.press('Escape')
  await collapseSummaryPanel(page)
}

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

  await pickKosztorysOption(page, SAVE_PRESET_ITEM)
  await saveDialog(page).getByPlaceholder('Nazwa szablonu').fill(presetName)
  await saveDialog(page).getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expectToast(page, 'Szablon o tej nazwie już istnieje')
  await expect(saveDialog(page)).toBeVisible()

  // The toggle only renders once a szablon exists, so reaching it is also the proof the first save landed.
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
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1)
  await expect(gridRow(page, 'Praca szablonowa dwa')).toHaveCount(1)
  await expect(gridRow(page, 'Praca pomocnicza')).toHaveCount(1)

  // Read off the input's value, not the cell's text: „Przedmiar" is typed by hand, so its cell IS an
  // <input> and carries no text node at all.
  const przedmiar = await rowCell(page, 'Praca szablonowa jeden', COLUMN_LABELS.plannedQty)
  await expect(przedmiar.locator('input')).toHaveValue('0')
  await expect(
    page.locator('.dsg-row.dsg-row-header .dsg-cell').filter({ hasText: 'Etap 1' }),
  ).toHaveCount(0)

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

  await withSettlementOptions(page, async () => {
    await pickDiscountMode(page, 'Kwotowy')
    await applyDiscountAmount(page, 500)
  })

  await pickKosztorysOption(page, RELOAD_PRESET_ITEM)
  await expect(reloadDialog(page)).toContainText('Zniknie: 1 sekcja · 1 praca')
  await reloadDialog(page).getByPlaceholder('Szukaj szablonu…').fill(presetName)
  await reloadDialog(page).getByRole('button', { name: presetName }).click()
  await expect(reloadDialog(page)).toContainText('Wejdzie: 2 sekcje · 3 prace')

  await reloadDialog(page).getByRole('button', { name: 'Wczytaj i zastąp', exact: true }).click()
  await expectToast(page, 'Wczytano: 2 sekcje · 3 prace')

  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1, { timeout: 20_000 })
  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(0)

  await openEditor(page, seed.reload)
  await expect(gridRow(page, 'Praca szablonowa jeden')).toHaveCount(1)
  await expect(gridRow(page, 'Praca do zastąpienia')).toHaveCount(0)

  await withSettlementOptions(page, async () => {
    await expect(discountModeSelect(page)).toHaveText('Wyłączony')
  })

  // The label names the szablon because the restore points are otherwise indistinguishable.
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
  // An etap quantity is typed by hand, i.e. an input — read the value, it has no text node.
  const restoredStage = await rowCell(page, 'Praca do zastąpienia', 'Etap 1')
  await expect(restoredStage.locator('input')).toHaveValue('2')
})
