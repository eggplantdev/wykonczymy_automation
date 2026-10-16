import { test, expect, type Locator, type Page } from '@playwright/test'
import { pickComboOption } from './drivers/combo'
import { waitForHydration } from './support/wait'

test.use({ storageState: 'e2e/.auth/user.json' })

const stamp = Date.now()
const EQUIPMENT = `Szlifierka E2E ${stamp}`
const SERIAL = `SN-${stamp}`
const WAREHOUSE = `Magazyn E2E ${stamp}`

// The index comes off the rendered header rather than being pinned: the listing's columns are a
// per-user visibility setting.
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
 * The returned string is the point: the spec never spells the expected date itself, it compares the
 * day the picker committed against the day the edit dialog reopens on.
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
  test.slow()

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

  // A brand-new magazyn holds exactly the item this test puts in it.
  await addDialog.getByRole('button', { name: 'Nowy magazyn' }).click()
  await addDialog.getByPlaceholder('Nazwa magazynu').fill(WAREHOUSE)
  await addDialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(addDialog.getByLabel('Magazyn', { exact: true })).toContainText(WAREHOUSE)

  await addDialog.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByPlaceholder('Szukaj sprzętu...').fill(EQUIPMENT)
  const listingRow = page.locator('table tbody tr').filter({ hasText: EQUIPMENT }).first()
  await expect(listingRow).toBeVisible()
  await expect(await equipmentCell(page, EQUIPMENT, 'Miejsce')).toContainText(WAREHOUSE)
  await expect(await equipmentCell(page, EQUIPMENT, 'Kto ma')).toHaveText('—')
  // The alarm state a swallowed first event would produce.
  await expect(listingRow).not.toContainText('Nie wiadomo gdzie')

  await page.getByRole('button', { name: /Gdzie jest/ }).click()
  // The selection is debounced and flushed when the panel closes, which is what Escape is for.
  await page.getByRole('option', { name: WAREHOUSE, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(listingRow).toBeVisible()
  // „Brak danych" is itself a tbody row, so counting rows alone would pass on an empty table.
  await expect(page.locator('table tbody tr')).toHaveCount(1)

  await listingRow.click()
  await page.waitForURL(/\/sprzet\/\d+$/)
  await expect(infoValue(page, 'Gdzie jest')).toContainText(WAREHOUSE)

  await page.getByRole('button', { name: 'Edytuj sprzęt' }).click()
  const editDialog = page.getByRole('dialog')
  await editDialog.waitFor()
  await expect(editDialog.getByLabel('Data zakupu', { exact: true })).toHaveText(purchaseDay)
  await expect(editDialog.getByLabel('Gwarancja do', { exact: true })).toHaveText(warrantyDay)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

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
  await expect(await equipmentCell(page, EQUIPMENT, 'Miejsce')).toHaveText('—')

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
