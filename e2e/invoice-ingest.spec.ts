import {
  test,
  expect,
  type FileChooser,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { refreshUntil, waitForHydration } from './support/wait'
import { createInvestmentExpense, EXPENSE_REGISTER, openExpenseDialog } from './drivers/expenses'

// • **Two of these tests write real bytes to Vercel Blob.**
// • **The fixtures are fabricated, and must stay that way.** — every HEIC in this repo's dumps is a
//   real client invoice.
test.use({ storageState: 'e2e/.auth/user.json' })

const FIXTURE = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

// Chrome cannot decode HEIC on canvas, so this exercises the heic-to WASM fallback
const HEIC = FIXTURE('paragon.heic')
const RECEIPTS = ['paragon-a.jpg', 'paragon-b.jpg', 'paragon-c.jpg'].map(FIXTURE)

// A row on /kasa/[id] we own, so „Edytuj transakcję" is enabled and the faktura cell starts empty.
async function seedOwnExpense(page: Page, tag: string): Promise<string> {
  const description = `E2E-${tag}-${Date.now()}`
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await createInvestmentExpense(page, '1.23', description)
  await expect(page.getByRole('cell', { name: description }).first()).toBeVisible()
  return description
}

const rowOf = (page: Page, description: string) =>
  page.getByRole('row').filter({ hasText: description })

const filePicker = (scope: Locator) => scope.locator('div[role="button"]:has(input[type="file"])')

const savedAs = (base: string) => new RegExp(`${base}-[0-9a-z]{6}\\.jpg`)
const previewOf = (base: string) => new RegExp(`^Podgląd faktury: ${base}-[0-9a-z]{6}\\.jpg$`)

// A selector aimed at the hidden input instead would keep passing after the control stopped opening it.
async function pickThrough(
  page: Page,
  open: () => Promise<void>,
  files: Parameters<FileChooser['setFiles']>[0],
): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), open()])
  await chooser.setFiles(files)
}

test('HEIC z pickera edycji przelewu zapisuje się jako JPG (EX-732)', async ({ page }) => {
  const description = await seedOwnExpense(page, 'heic')

  const edit = rowOf(page, description).getByRole('button', { name: 'Edytuj transakcję' })
  await waitForHydration(edit)
  await edit.click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edytuj transakcję' })
  await expect(dialog).toBeVisible()

  await pickThrough(page, () => filePicker(dialog).click(), [HEIC])

  const save = dialog.getByRole('button', { name: 'Zapisz' })
  await expect(save).toBeEnabled({ timeout: 60_000 })
  await save.click()
  await expect(dialog).toBeHidden()

  // The picker still said „paragon.heic" — it shows what it was handed, not what
  // survived — so the only honest read of „it was converted" is the name the SAVED faktura carries.
  await refreshUntil(page, () =>
    expect(
      rowOf(page, description).getByRole('button', { name: previewOf('paragon') }),
    ).toBeVisible({ timeout: 5_000 }),
  )
})

test('nieczytelny HEIC nie wchodzi do formularza (EX-460)', async ({ page }) => {
  const description = await seedOwnExpense(page, 'blocked')

  const edit = rowOf(page, description).getByRole('button', { name: 'Edytuj transakcję' })
  await waitForHydration(edit)
  await edit.click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edytuj transakcję' })
  const picker = filePicker(dialog)

  await pickThrough(page, () => picker.click(), [
    { name: 'zepsute.heic', mimeType: 'image/heic', buffer: Buffer.from('nie-jest-heic') },
  ])

  await expect(
    page.getByText(
      'Nie udało się przekonwertować „zepsute.heic” — zapisz jako JPG i spróbuj ponownie.',
    ),
  ).toBeVisible({ timeout: 60_000 })

  // It shows the names it was handed, so after a total refusal it would otherwise keep advertising an attachment that is not in `files`
  await expect(picker).toHaveText('Przeciągnij lub kliknij')

  const save = dialog.getByRole('button', { name: 'Zapisz' })
  await expect(save).toBeEnabled()
  await save.click()
  await page.getByRole('button', { name: 'Zapisz bez faktury' }).click()
  await expect(dialog).toBeHidden()
  await expect(
    rowOf(page, description).getByRole('button', { name: 'Dodaj fakturę' }),
  ).toBeVisible()
})

test('okno „Dodaj fakturę" w tabeli przyjmuje kilka stron naraz (EX-663)', async ({ page }) => {
  const description = await seedOwnExpense(page, 'cell')

  const add = rowOf(page, description).getByRole('button', { name: 'Dodaj fakturę' })
  await waitForHydration(add)
  await add.click()

  const upload = page.getByRole('dialog').filter({ hasText: 'Dodaj fakturę' })
  await pickThrough(page, () => filePicker(upload).click(), RECEIPTS.slice(0, 2))

  await expect(page.getByText('Faktura dodana')).toBeVisible({ timeout: 60_000 })

  const preview = rowOf(page, description).getByRole('button', { name: previewOf('paragon-a') })
  await refreshUntil(page, () => expect(preview).toBeVisible({ timeout: 5_000 }))
  await preview.click()

  // Filtered by a pattern, not by page 1's name: the filter is re-evaluated on every assertion, and
  // paging to page 2 replaces the very text a fixed-name filter matched on.
  const dialog = page.getByRole('dialog').filter({ hasText: savedAs('paragon-[ab]') })
  await expect(dialog.getByText('1 / 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog.getByText('2 / 2')).toBeVisible()
  await expect(dialog).toContainText(savedAs('paragon-b'))
})

// One scan per picked file, answered from the file's own name so a result landing on the wrong row
// is visible as a wrong VALUE rather than as a missing one.
async function stubExtractReceipt(page: Page, reply: (filenames: string[]) => unknown) {
  await page.route('**/api/extract-receipt', async (route: Route) => {
    const body = route.request().postData() ?? ''
    const filenames = [...body.matchAll(/filename="([^"]+)"/g)].map((match) => match[1])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: reply(filenames) }),
    })
  })
}

const scanMode = (page: Page, label: string) =>
  page.locator('[aria-label="Co oznaczają wybrane zdjęcia"]').getByText(label, { exact: true })

async function openExpenseDialogOnRegister(page: Page): Promise<void> {
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openExpenseDialog(page)
}

test('„Kilka wydatków" daje jeden wiersz na zdjęcie, każdy ze swoim odczytem (EX-444)', async ({
  page,
}) => {
  await stubExtractReceipt(page, (filenames) => {
    const letter = (filenames.find((name) => name.startsWith('paragon-')) ?? '?').charAt(8)
    return {
      description: `Paragon ${letter.toUpperCase()}`,
      amount: { a: 11, b: 22, c: 33 }[letter] ?? 0,
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
      filename: `paragon-${letter}.jpg`,
    }
  })

  await openExpenseDialogOnRegister(page)
  await scanMode(page, 'Kilka wydatków').click()
  await pickThrough(
    page,
    () => page.getByRole('button', { name: 'Wygeneruj z paragonów' }).click(),
    RECEIPTS,
  )

  await expect(page.getByText('Odczytano 3 z 3 paragonów')).toBeVisible({ timeout: 60_000 })

  // the lone blank starting row is reused for the first one rather than left hanging above them, so a fourth empty row here means the reuse broke.
  const opis = page.getByLabel('Opis')
  await expect(opis).toHaveCount(3)
  const kwota = page.getByLabel('Kwota')
  await expect(kwota).toHaveCount(3)

  await expect(opis.nth(0)).toHaveValue('Paragon A')
  await expect(kwota.nth(0)).toHaveValue('11')
  await expect(opis.nth(1)).toHaveValue('Paragon B')
  await expect(kwota.nth(1)).toHaveValue('22')
  await expect(opis.nth(2)).toHaveValue('Paragon C')
  await expect(kwota.nth(2)).toHaveValue('33')

  await expect(page.getByRole('button', { name: 'Podgląd faktury: paragon-a.jpg' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Podgląd faktury: paragon-c.jpg' })).toBeVisible()
})

test('„Jeden wydatek" skleja zdjęcia w jedną wielostronicową fakturę (EX-661)', async ({
  page,
}) => {
  await stubExtractReceipt(page, () => ({
    description: 'Faktura zbiorcza',
    amount: 99.5,
    netAmount: null,
    invoiceNote: 'E2E',
    otherCategoryName: '',
    filename: 'faktura.jpg',
  }))

  await openExpenseDialogOnRegister(page)
  await scanMode(page, 'Jeden wydatek').click()
  await pickThrough(
    page,
    () => page.getByRole('button', { name: 'Wygeneruj z paragonów' }).click(),
    RECEIPTS,
  )

  await expect(page.getByText('Odczytano 1 z 1 paragonów')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByLabel('Opis')).toHaveCount(1)
  await expect(page.getByLabel('Opis')).toHaveValue('Faktura zbiorcza')

  const preview = page.getByRole('button', { name: 'Podgląd faktury: faktura.jpg' })
  await expect(preview).toBeVisible()
  await preview.click()

  const dialog = page.getByRole('dialog').filter({ hasText: /faktura(-\d+)?\.jpg/ })
  await expect(dialog.getByText('1 / 3')).toBeVisible()
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog).toContainText('faktura-2.jpg')
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog).toContainText('faktura-3.jpg')
  await expect(dialog.getByRole('button', { name: 'Pobierz wszystkie' })).toBeVisible()
})
