import {
  test,
  expect,
  type FileChooser,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import { fileURLToPath } from 'node:url'
import {
  createInvestmentExpense,
  EXPENSE_REGISTER,
  openExpenseDialog,
  waitForHydration,
} from './helpers'

// Ingest plików — the one slice of this app that exists ONLY in the browser.
//
// EX-732, EX-661, EX-663, EX-460 and EX-444 are five issues over one pipeline: pick →
// `processUploadFile` (classify → HEIC-convert / compress / passthrough → rename → 4 MB guard) →
// `POST /api/upload-file` → action. Nothing below the browser can run it: the HEIC decode is a
// canvas/WASM fact, the compression is CompressorJS, the 4 MB guard measures POST-compression
// bytes, and the pairing of a picked file to the row it belongs to survives only in React state.
// So they share ONE file — five seeds and five dialog boot-ups for the same pipeline would be
// paid five times over.
//
// Two things a reader must know before running this:
//
// • **Two of these tests write real bytes to Vercel Blob.** `payload.config.ts` wires
//   `vercelBlobStorage` with no local-disk fallback, so an upload that reaches the action lands in
//   the store `BLOB_READ_WRITE_TOKEN` points at — which off `.env` is the PREVIEW store, scratch by
//   definition (wiped and re-restored). That is acceptable here and nowhere near production; see
//   AGENTS.md „The production Vercel Blob store belongs to production only".
// • **The fixtures are fabricated, and must stay that way.** `e2e/fixtures/*` were generated from
//   synthetic gradients (`sips -s format heic/jpeg`), not from anything in `dumps/` — every HEIC in
//   this repo's dumps is a real client invoice. The oversize and the unconvertible-HEIC fixtures are
//   minted in-memory below rather than committed: one would add 4 MB to the repo, the other is
//   twelve bytes of garbage whose only job is to fail both decoders.
//
// `/api/extract-receipt` is a BROWSER fetch (`scanReceiptClient` → `postFormData`), so `page.route`
// reaches it — the two scan tests stub it and never touch OpenRouter.
test.use({ storageState: 'e2e/.auth/user.json' })

const FIXTURE = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))

// Real HEVC-still bytes, 1.5 KB. Chrome cannot decode HEIC on canvas, so this exercises the
// heic-to WASM fallback — the path every non-Safari user is on, and the one EX-732 is about.
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

// A `FileInput`'s clickable surface — the wrapper that owns the hidden input, not the input itself.
// Its text is the filename it was handed, or the placeholder when it holds nothing, which is the one
// thing this component says out loud about whether a pick survived.
const filePicker = (scope: Locator) => scope.locator('div[role="button"]:has(input[type="file"])')

// What a picked file is CALLED once it is stored. `uniqueFileName` appends a six-char id to every
// upload (`appendShortId`), because the blob plugin deliberately runs without `addRandomSuffix` —
// that would rewrite Payload's `filename` into a ~30-char blob key and put it in front of the user.
// So the id is mandatory, and it is not Payload's „-N" uniquifier: it lands on the first upload of
// a name as much as on the fifth. What these assertions are actually about is the EXTENSION.
const savedAs = (base: string) => new RegExp(`${base}-[0-9a-z]{6}\\.jpg`)
const previewOf = (base: string) => new RegExp(`^Podgląd faktury: ${base}-[0-9a-z]{6}\\.jpg$`)

// Every picker here is a hidden input behind a real control, so the files go in through the control
// the person actually clicks — the chooser event is what couples the two. A selector aimed at the
// hidden input instead would keep passing after the control stopped opening it.
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

  // Submit is disabled for exactly as long as the convert runs, and that gate is the whole reason
  // an unconverted .heic never reaches Blob. Waited on rather than sampled: the assertion below is
  // meaningless if the click landed before ingest finished.
  const save = dialog.getByRole('button', { name: 'Zapisz' })
  await expect(save).toBeEnabled({ timeout: 60_000 })
  await save.click()
  await expect(dialog).toBeHidden()

  // The payoff. The picker still said „paragon.heic" — it shows what it was handed, not what
  // survived — so the only honest read of „it was converted" is the name the SAVED faktura carries.
  // A raw HEIC riding through would leave „paragon.heic" here, which is precisely the bug: Blob
  // stores it, and every browser but Safari then renders a broken image forever.
  // The extension is the whole of EX-732.
  await expect(
    rowOf(page, description).getByRole('button', { name: previewOf('paragon') }),
  ).toBeVisible()
})

test('nieczytelny HEIC i plik ponad 4 MB nie wchodzą do formularza (EX-460)', async ({ page }) => {
  const description = await seedOwnExpense(page, 'blocked')

  const edit = rowOf(page, description).getByRole('button', { name: 'Edytuj transakcję' })
  await waitForHydration(edit)
  await edit.click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edytuj transakcję' })
  const picker = filePicker(dialog)

  // Classification is by extension as well as mime (Chrome reports an empty type for HEIC), so a
  // file named .heic takes the HEIC path — canvas refuses it, then the WASM decoder refuses it,
  // and it is blocked rather than uploaded as an undecodable blob.
  await pickThrough(page, () => picker.click(), [
    { name: 'zepsute.heic', mimeType: 'image/heic', buffer: Buffer.from('nie-jest-heic') },
  ])

  await expect(
    page.getByText(
      'Nie udało się przekonwertować „zepsute.heic” — zapisz jako JPG i spróbuj ponownie.',
    ),
  ).toBeVisible({ timeout: 60_000 })

  // The picker has to go BACK to empty. It shows the names it was handed, so after a total refusal
  // it would otherwise keep advertising an attachment that is not in `files` — the person saves,
  // the row persists with no faktura, and nothing ever said so.
  await expect(picker).toHaveText('Przeciągnij lub kliknij')

  // The guard measures POST-compression bytes, so only a non-image can trip it in practice — a
  // photo is resized under the cap on its way through. A PDF is the real-world case (EX-457).
  await pickThrough(page, () => picker.click(), [
    {
      name: 'wielka-faktura.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 0x20),
    },
  ])

  await expect(
    page.getByText('Plik „wielka-faktura.pdf” przekracza 4 MB — zmniejsz go i spróbuj ponownie.'),
  ).toBeVisible({ timeout: 60_000 })
  await expect(picker).toHaveText('Przeciągnij lub kliknij')

  // And the refusals cost the row nothing: saving now stores a transfer with no faktura at all,
  // rather than one pointing at bytes that never made it.
  const save = dialog.getByRole('button', { name: 'Zapisz' })
  await expect(save).toBeEnabled()
  await save.click()
  await expect(dialog).toBeHidden()
  await expect(
    rowOf(page, description).getByRole('button', { name: 'Dodaj fakturę' }),
  ).toBeVisible()
})

test('okno „Dodaj fakturę" w tabeli przyjmuje kilka stron naraz (EX-663)', async ({ page }) => {
  const description = await seedOwnExpense(page, 'cell')

  // The issue was filed when this dialog had been removed; it is back (`invoice-cell.tsx`), so the
  // risk is live again — and it is the only pick surface where the upload fires with no „Zapisz"
  // to gate it: the pick IS the confirmation.
  const add = rowOf(page, description).getByRole('button', { name: 'Dodaj fakturę' })
  await waitForHydration(add)
  await add.click()

  const upload = page.getByRole('dialog').filter({ hasText: 'Dodaj fakturę' })
  await pickThrough(page, () => filePicker(upload).click(), RECEIPTS.slice(0, 2))

  await expect(page.getByText('Faktura dodana')).toBeVisible({ timeout: 60_000 })

  // Both pages reached the action as ONE invoice, in pick order, and the cell learned of it through
  // router.refresh() with no reload of ours.
  const preview = rowOf(page, description).getByRole('button', { name: previewOf('paragon-a') })
  await expect(preview).toBeVisible()
  await preview.click()

  // Filtered by a pattern, not by page 1's name: the filter is re-evaluated on every assertion, and
  // paging to page 2 replaces the very text a fixed-name filter matched on.
  const dialog = page.getByRole('dialog').filter({ hasText: savedAs('paragon-[ab]') })
  await expect(dialog.getByText('1 / 2')).toBeVisible()
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog.getByText('2 / 2')).toBeVisible()
  // The pager is not decoration: page 2 is a different file, and a set that collapsed to one page
  // (or repeated page 1) is the failure this catches.
  await expect(dialog).toContainText(savedAs('paragon-b'))
})

// One scan per picked file, answered from the file's own name so a result landing on the wrong row
// is visible as a wrong VALUE rather than as a missing one. Multipart bodies keep their
// `filename="…"` headers in plain ASCII, which is what makes the request readable at all.
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

// From the register's own page, so the dialog seeds the kasa from the route rather than the spec
// having to pick it.
async function openExpenseDialogOnRegister(page: Page): Promise<void> {
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)
  await openExpenseDialog(page)
}

test('„Kilka wydatków" daje jeden wiersz na zdjęcie, każdy ze swoim odczytem (EX-444)', async ({
  page,
}) => {
  // The backbone under test is the pairing: rows are minted up front so `ids[i]` can hold
  // `picked[i]`, and every marker set keys on a row's stable id rather than its position. Answering
  // each scan with its own file's letter turns a misalignment into „11 zł landed on wiersz C",
  // which an assertion can see; answering all three identically would hide it completely.
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

  // Three photos, three rows — the lone blank starting row is reused for the first one rather than
  // left hanging above them, so a fourth empty row here means the reuse broke.
  const opis = page.getByLabel('Opis')
  await expect(opis).toHaveCount(3)
  const kwota = page.getByLabel('Kwota')
  await expect(kwota).toHaveCount(3)

  // Read in row order. Each row carries the figures from ITS OWN photo; any swap between two rows
  // fails here, and that is the entire point of the id-keyed pairing.
  await expect(opis.nth(0)).toHaveValue('Paragon A')
  await expect(kwota.nth(0)).toHaveValue('11')
  await expect(opis.nth(1)).toHaveValue('Paragon B')
  await expect(kwota.nth(1)).toHaveValue('22')
  await expect(opis.nth(2)).toHaveValue('Paragon C')
  await expect(kwota.nth(2)).toHaveValue('33')

  // And each row's FV shows its own page, renamed to the Opis-derived name — the label is how a
  // person confirms the photo they attached is the one that was read.
  await expect(page.getByRole('button', { name: 'Podgląd faktury: paragon-a.jpg' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Podgląd faktury: paragon-c.jpg' })).toBeVisible()
})

test('„Jeden wydatek" skleja zdjęcia w jedną wielostronicową fakturę (EX-661)', async ({
  page,
}) => {
  // Nothing about the files themselves can tell „three paragony" from „one three-page faktura", so
  // the toggle IS the input — the same three photos must produce a different shape here than in the
  // test above. One scan goes out, carrying all three pages.
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

  // Page 1 keeps the bare name; the later pages get „-2" / „-3". Without that every page of one
  // faktura would upload under one filename — and the trigger only ever shows page 1, so the suffix
  // is invisible until the preview is open. Which is exactly where it is asserted.
  const preview = page.getByRole('button', { name: 'Podgląd faktury: faktura.jpg' })
  await expect(preview).toBeVisible()
  await preview.click()

  const dialog = page.getByRole('dialog').filter({ hasText: /faktura(-\d+)?\.jpg/ })
  await expect(dialog.getByText('1 / 3')).toBeVisible()
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog).toContainText('faktura-2.jpg')
  await dialog.getByRole('button', { name: 'Następna strona' }).click()
  await expect(dialog).toContainText('faktura-3.jpg')
  // The set-level controls only exist for a multi-page faktura; a three-page invoice collapsed to
  // one page would silently lose them along with the pages.
  await expect(dialog.getByRole('button', { name: 'Pobierz wszystkie' })).toBeVisible()
})
