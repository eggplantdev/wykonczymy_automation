import { test, expect } from '@playwright/test'
import { waitForHydration } from './support/wait'
import { readSeed } from './support/seeds'
import { filePicker, pickThrough, rowOf } from './drivers/invoices'
import { EXPENSE_REGISTER } from '@/scripts/e2e-dump-rows'

// A padded image would be recompressed under the threshold and never reach the browser → Blob →
// `/api/media-register` path.
const BIG_PDF = {
  name: 'faktura-duza.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024, 0x20)]),
}

test('faktura powyżej 4 MB trafia do Blob z przeglądarki i zostaje przypięta do transakcji', async ({
  page,
}) => {
  test.slow()
  const description = readSeed('invoiceIngest').bigPdf
  await page.goto(`/kasa/${EXPENSE_REGISTER.id}`)

  const add = rowOf(page, description).getByRole('button', { name: 'Dodaj fakturę' })
  await waitForHydration(add)
  await add.click()

  const upload = page.getByRole('dialog').filter({ hasText: 'Dodaj fakturę' })
  const registered = page.waitForResponse('**/api/media-register')
  await pickThrough(page, () => filePicker(upload).click(), BIG_PDF)

  expect((await registered).status()).toBe(200)
  await expect(page.getByText('Faktura dodana')).toBeVisible({ timeout: 60_000 })

  await page.reload()
  await expect(
    rowOf(page, description).getByRole('button', {
      name: /^Podgląd faktury: faktura-duza-[0-9a-z]{12}\.pdf$/,
    }),
  ).toBeVisible()
})
