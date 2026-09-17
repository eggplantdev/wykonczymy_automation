import { test, expect, type Locator, type Page } from '@playwright/test'
import { pickComboOption, waitForHydration } from './helpers'

// EX-771 — the equipment register's spine: an item is entered, it is handed on, and at every moment
// the app must be able to answer „gdzie to jest". Three boundaries have to agree for that answer to
// be right, and none of them is visible from a unit spec:
//
//   1. „Dodaj sprzęt" writes the ITEM and its FIRST EVENT in one submit. If the event were lost the
//      item would be born in the register's alarm state („Nie wiadomo gdzie") — a fresh purchase
//      whose magazyn was typed in the same dialog that swallowed it.
//   2. „Przekaż" does not move a row: it appends an event, and the place is a `DISTINCT ON` over the
//      history. The previous location must therefore go SILENT by itself — nothing deletes it — on
//      the listing and on the worker's „Na stanie" card, which is the surface a rozliczenie reads.
//   3. „Edytuj sprzęt" opens on values that made a round trip through a Postgres `Date`. A column
//      read back as UTC midnight renders as the previous day in Warsaw, which is how an edit that
//      touched only „Uwagi" used to move the warranty a day back.
//
// The „gdzie jest" rule itself (`src/__tests__/lib/db/equipment.db.test.ts`), the filter's
// option/row grammar (`src/__tests__/components/equipment/where-filter-options.test.ts`) and the
// warranty buckets (`warranty-digest.test.ts`) are already proven below the browser — this spec
// asserts only what needs the three boundaries wired together.
test.use({ storageState: 'e2e/.auth/user.json' })

const stamp = Date.now()
const EQUIPMENT = `Szlifierka E2E ${stamp}`
const SERIAL = `SN-${stamp}`
const WAREHOUSE = `Magazyn E2E ${stamp}`

// One row's cell, by the header the owner reads it under. The index comes off the rendered header
// rather than being pinned: the listing's columns are a per-user visibility setting.
async function equipmentCell(page: Page, rowText: string, header: string): Promise<Locator> {
  const headers = page.locator('table thead th')
  await headers.first().waitFor()
  const texts = await headers.allTextContents()
  const index = texts.findIndex((text) => text.trim().startsWith(header))
  if (index < 0) throw new Error(`no „${header}" column on /sprzet: ${texts.join(' | ')}`)
  return page
    .locator('table tbody tr')
    .filter({ hasText: rowText })
    .first()
    .locator('td')
    .nth(index)
}

const infoValue = (page: Page, label: string) =>
  page
    .locator('dl > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd')

/**
 * Pick a day in the CURRENT month of a `FormDatePicker` and return what the trigger then prints.
 *
 * The returned string is the point: the spec never spells the expected date itself, it compares the
 * day the picker committed against the day the edit dialog reopens on. A UTC-midnight shift changes
 * one and not the other, which is exactly risk 3 — and nothing here has to know the pl format.
 */
async function pickDayOfThisMonth(page: Page, label: string, day: number): Promise<string> {
  const trigger = page.getByLabel(label, { exact: true })
  await trigger.click()
  const calendar = page.locator('[data-slot=calendar]').last()
  await calendar.waitFor()
  // Days spilling in from the neighbouring months carry the same numbers, so they are excluded by
  // class — otherwise „1" is ambiguous in most months.
  await calendar
    .locator('td:not(.rdp-outside) button')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first()
    .click()
  await expect(trigger).not.toContainText('Wybierz datę')
  return ((await trigger.textContent()) ?? '').trim()
}

// The worker the tool is handed to is read off the combobox rather than hard-coded: the test DB is a
// restored prod dump, so any name pinned here is one roster change away from failing for a reason
// that has nothing to do with the register.
async function pickFirstWorker(page: Page): Promise<string> {
  const trigger = page.getByLabel('Pracownik', { exact: true })
  await trigger.click()
  const option = page.getByRole('option').first()
  await option.waitFor()
  const name = ((await option.textContent()) ?? '').trim()
  await page.keyboard.press('Escape')
  await page.locator('[data-radix-popper-content-wrapper]').first().waitFor({ state: 'detached' })
  await pickComboOption(page, 'Pracownik', name)
  return name
}

test('dodany sprzęt od razu leży tam, gdzie go wpisano, a przekazanie gasi poprzednie miejsce', async ({
  page,
}) => {
  // Eleven route renders and three server actions — comfortably past the default budget.
  test.slow()

  // --- Dodanie: item + pierwsze zdarzenie w jednym submicie (ryzyko 1) ---
  await page.goto('/sprzet')
  const addTrigger = page.getByRole('button', { name: 'Sprzęt', exact: true })
  await addTrigger.waitFor()
  await waitForHydration(addTrigger)
  await addTrigger.click()

  const addDialog = page.getByRole('dialog')
  await addDialog.waitFor()
  await addDialog.getByLabel('Nazwa', { exact: true }).fill(EQUIPMENT)
  await addDialog.getByLabel('Numer seryjny', { exact: true }).fill(SERIAL)
  const purchaseDay = await pickDayOfThisMonth(page, 'Data zakupu', 1)
  const warrantyDay = await pickDayOfThisMonth(page, 'Gwarancja do', 28)

  // A magazyn created from inside the form, so the destination cannot be one the dump happens to
  // carry — a brand-new magazyn holds exactly the item this test puts in it.
  await addDialog.getByRole('button', { name: 'Nowy magazyn' }).click()
  await addDialog.getByPlaceholder('Nazwa magazynu').fill(WAREHOUSE)
  await addDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(addDialog.getByLabel('Magazyn', { exact: true })).toContainText(WAREHOUSE)

  await addDialog.getByRole('button', { name: 'Dodaj', exact: true }).click()
  // The dialog closes only on a successful action, so this is the submit's own verdict.
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByPlaceholder('Szukaj sprzętu...').fill(EQUIPMENT)
  const listingRow = page.locator('table tbody tr').filter({ hasText: EQUIPMENT }).first()
  await expect(listingRow).toBeVisible()
  await expect(await equipmentCell(page, EQUIPMENT, 'Miejsce')).toContainText(WAREHOUSE)
  await expect(await equipmentCell(page, EQUIPMENT, 'Kto ma')).toHaveText('—')
  // The alarm state a swallowed first event would produce.
  await expect(listingRow).not.toContainText('Nie wiadomo gdzie')

  // The filter's option and the row's own value are computed apart (`whereFilterOptions` from the
  // whole dataset, `whereFilterValue` per row); picking the magazyn is what proves they agree.
  await page.getByRole('button', { name: /Gdzie jest/ }).click()
  // The menu opens with every option ticked — an untouched filter hides nothing — so narrowing it to
  // one magazyn is „Odznacz wszystkie" and then that option, not a single click. The selection is
  // debounced and flushed when the panel closes, which is what Escape is for.
  await page.getByRole('option', { name: 'Odznacz wszystkie', exact: true }).click()
  await page.getByRole('option', { name: WAREHOUSE, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(listingRow).toBeVisible()
  // „Brak danych" is itself a tbody row, so counting rows alone would pass on an empty table.
  await expect(page.locator('table tbody tr')).toHaveCount(1)

  await listingRow.click()
  await page.waitForURL(/\/sprzet\/\d+$/)
  await expect(infoValue(page, 'Gdzie jest')).toContainText(WAREHOUSE)

  // --- „Edytuj sprzęt" opens on the same days that were saved (risk 3) ---
  await page.getByRole('button', { name: 'Edytuj sprzęt' }).click()
  const editDialog = page.getByRole('dialog')
  await editDialog.waitFor()
  await expect(editDialog.getByLabel('Data zakupu', { exact: true })).toHaveText(purchaseDay)
  await expect(editDialog.getByLabel('Gwarancja do', { exact: true })).toHaveText(warrantyDay)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // --- Handover: the new place speaks, the previous one goes silent (risk 2) ---
  await page.getByRole('button', { name: 'Przekaż sprzęt' }).click()
  const transferDialog = page.getByRole('dialog')
  await transferDialog.waitFor()
  await transferDialog.getByLabel('Gdzie trafia', { exact: true }).click()
  await page.getByRole('option', { name: 'Pracownik', exact: true }).click()
  const worker = await pickFirstWorker(page)
  await transferDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(infoValue(page, 'Gdzie jest')).toContainText(worker)

  await page.goto('/sprzet')
  await page.getByPlaceholder('Szukaj sprzętu...').fill(EQUIPMENT)
  await expect(await equipmentCell(page, EQUIPMENT, 'Kto ma')).toContainText(worker)
  // Nothing deleted the magazyn event — the newer one simply wins the `DISTINCT ON`.
  await expect(await equipmentCell(page, EQUIPMENT, 'Miejsce')).toHaveText('—')

  // The card a rozliczenie (or somebody leaving) is read off.
  await page.goto('/pracownicy')
  await page.locator('table tbody tr').filter({ hasText: worker }).first().click()
  await page.waitForURL(/\/pracownicy\/\d+/)
  const held = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Na stanie', exact: true }) })
    .last()
  await expect(held).toContainText(EQUIPMENT)
  await expect(held).toContainText(SERIAL)
})
