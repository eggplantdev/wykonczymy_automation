import { test, expect, type Page } from '@playwright/test'
import { settleWrite, waitForHydration } from './support/wait'
import { collapseSummaryPanel, editorCell } from './drivers/kosztorys-grid'

test.use({ storageState: 'e2e/.auth/user.json' })

// No other spec books against it, and this one always hands it back active.
const LOCKED_INVESTMENT = { id: 124, name: 'Agnieszka żochowska ul. Człuchowska' }

async function setStatus(page: Page, status: string): Promise<void> {
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const edit = page.getByRole('button', { name: 'Edytuj inwestycję' })
  await edit.waitFor()
  await waitForHydration(edit)
  await edit.click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Edytuj inwestycję' })
  await dialog.waitFor()
  const select = dialog.getByLabel('Status')
  if (((await select.textContent()) ?? '').includes(status)) {
    await page.keyboard.press('Escape')
    return
  }
  await select.click()
  await page.getByRole('option', { name: status, exact: true }).click()
  const save = dialog.getByRole('button', { name: 'Zapisz', exact: true })

  // The submit is fire-and-forget over an optimistic store, so the caller's next `goto` would abort
  // the very status change it is about to read back.
  if (status === 'Zakończona') {
    await save.click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('tylko do odczytu')
    await settleWrite(page, () => confirm.getByRole('button', { name: 'Zakończ' }).click())
  } else {
    await settleWrite(page, () => save.click())
  }
  await expect(dialog).toBeHidden()
}

async function openEditor(page: Page): Promise<void> {
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}/kosztorys_v2`)
  await collapseSummaryPanel(page)
}

const optionsMenu = (page: Page) => page.getByRole('button', { name: 'Opcje', exact: true })

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await setStatus(page, 'Aktywna')
  } finally {
    await page.close()
  }
})

// The status rides on `fetchReferenceData`, whose invalidated entry is still served once, so exactly
// one stale render is expected on locking AND on unlocking, and neither is the regression.
//
// The reload is bounded because `expect.poll` cannot abort a call already in flight: one left on the
// 90 s `navigationTimeout` would hold the poll well past its own deadline.
async function reloadUntilBanner(page: Page, want: 'present' | 'gone'): Promise<void> {
  const banner = page.getByRole('status').filter({ hasText: 'tylko do odczytu' })
  const agrees = async () => (await banner.count()) > 0 === (want === 'present')
  await expect
    .poll(async () => {
      if (await agrees()) return true
      await page.reload({ timeout: 15_000 })
      return agrees()
    })
    .toBe(true)
}

test('closing an investment locks the editor and the pickers, and reopening it gives them back', async ({
  page,
}) => {
  await setStatus(page, 'Aktywna')
  await openEditor(page)
  await expect(page.getByRole('button', { name: 'Dodaj' })).toBeVisible()

  await setStatus(page, 'Zakończona')

  await openEditor(page)
  await reloadUntilBanner(page, 'present')
  await expect(page.getByRole('button', { name: 'Dodaj' })).toHaveCount(0)

  const cell = await editorCell(page, 'Przedmiar ofertowy')
  await cell.click()
  await expect(cell.locator('input')).toHaveCount(0)

  await optionsMenu(page).click()
  await expect(page.getByRole('menuitem', { name: /Zapisz jako nowy szablon/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Wyczyść kosztorys/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Wczytaj szablon/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Pobierz z arkusza Google/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const wydatek = page.getByRole('button', { name: /Wydatek/ }).first()
  await waitForHydration(wydatek)
  await wydatek.click()
  await page.getByText('Nowy wydatek').first().waitFor()
  const investmentField = page.getByLabel('Inwestycja')
  await expect(investmentField).not.toContainText(LOCKED_INVESTMENT.name)
  await investmentField.click()
  await expect(page.getByRole('option', { name: LOCKED_INVESTMENT.name, exact: true })).toHaveCount(
    0,
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const edit = page.getByRole('button', { name: 'Edytuj inwestycję' })
  await waitForHydration(edit)
  await edit.click()
  await expect(page.getByLabel('Nazwa')).toBeEditable()
  await page.keyboard.press('Escape')

  await setStatus(page, 'Aktywna')
  await openEditor(page)
  await reloadUntilBanner(page, 'gone')
  await expect(page.getByRole('button', { name: 'Dodaj' })).toBeVisible()
  const reopened = await editorCell(page, 'Przedmiar ofertowy')
  await reopened.click()
  await expect(reopened.locator('input')).toHaveCount(1)
})
