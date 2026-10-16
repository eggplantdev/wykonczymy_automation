import { test, expect, type Page } from '@playwright/test'
import { type ReconSeedT, seedReconInvestments } from './support/seeds'
import {
  LOAD_VERSION_ITEM,
  openEditor,
  pickKosztorysOption as pickOption,
  versionsDrawer,
} from './drivers/kosztorys-grid'

test.use({ storageState: 'e2e/.auth/user.json' })

let seed: ReconSeedT

// The seed makes two investments and the tests take one each, so neither inherits the other's versions.
test.beforeAll(async ({ browser }) => {
  seed = await seedReconInvestments(browser)
})

const CLEAR_ITEM = /Usuwa całą rozpiskę/
const SAVE_VERSION_ITEM = /Zapisz bieżący stan jako nazwany punkt/

const seededItem = (page: Page) => page.getByText('Pozycja 1', { exact: true })

test('clearing a kosztorys empties the grid on the spot and leaves one version it comes back from', async ({
  page,
}) => {
  await openEditor(page, seed.match)
  await expect(seededItem(page).first()).toBeVisible()

  await pickOption(page, CLEAR_ITEM)

  const clearDialog = page.getByRole('dialog').filter({ hasText: 'Wyczyść kosztorys' })
  await expect(clearDialog).toContainText('1 sekcja')
  await expect(clearDialog).toContainText('1 praca')
  await clearDialog.getByRole('button', { name: 'Wyczyść', exact: true }).click()

  // No reload between the write and this read — the grid has to learn of its own wipe.
  await expect(page.getByText('Kosztorys jest pusty')).toBeVisible({ timeout: 90_000 })
  await expect(seededItem(page)).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Kosztorys jest pusty')).toBeVisible({ timeout: 90_000 })

  await pickOption(page, CLEAR_ITEM)
  await expect(clearDialog.getByRole('button', { name: 'Wyczyść', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')

  await pickOption(page, LOAD_VERSION_ITEM)

  const versions = versionsDrawer(page)
  await expect(versions.getByText('Przed wyczyszczeniem')).toBeVisible()
  const restore = versions.getByRole('button', { name: 'Przywróć' })
  await expect(restore).toHaveCount(1)
  await restore.click()

  const confirm = page.getByRole('alertdialog')
  // The restore is not a clean round trip and says so: the rabat globalny the wipe zeroed stays
  // zeroed.
  await expect(confirm).toContainText('rabat globalny')
  await confirm.getByRole('button', { name: 'Przywróć' }).click()

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

  const versions = versionsDrawer(page)
  await expect(versions.getByText(label)).toBeVisible()
  await expect(versions.getByText('Nazwane wersje')).toBeVisible()
  await expect(versions.getByText('Historia automatyczna')).toHaveCount(0)
  await expect(versions.getByRole('button', { name: 'Przywróć' })).toHaveCount(1)

  await versions.getByRole('button', { name: 'Przywróć' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Przywróć' }).click()
  await expect(seededItem(page).first()).toBeVisible({ timeout: 90_000 })

  // Counted, because „the section appeared" would also pass if the restore had written two.
  await pickOption(page, LOAD_VERSION_ITEM)
  await expect(versions.getByText('Historia automatyczna')).toBeVisible()
  await expect(versions.getByRole('button', { name: 'Przywróć' })).toHaveCount(2)
})
