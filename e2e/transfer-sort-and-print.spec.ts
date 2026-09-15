import { test, expect, type Page } from '@playwright/test'
import { parsePln, readColumn, EXPENSE_REGISTER } from './helpers'

// EX-781 — the screen's order and the printout's order are one order.
//
// The regression this guards (EX-777) was that the table sorted the hundred rows it had already
// been handed, while „Drukuj" refetched the whole filtered set and sorted a second, independent
// instance. Both looked right in isolation: the screen's first row really was the largest of its
// page, and the printout really was sorted. They only disagreed once you compared them — which is
// the one thing no layer below the browser can do, because the two orders are produced by two
// different processes (a server `payload.find` and a client table) that never meet in one process.
//
// What the cheaper layers already prove, and this spec therefore does not repeat: the parameter
// grammar (`parseTransferSort` / `sortParamToSortingState`), the whitelist agreeing with the UI's
// sortable columns, and the ordering spanning the whole dataset at the query layer
// (`src/__tests__/lib/queries/transfer-sort-spans-dataset.db.test.ts`). What is asserted here is
// only the wiring: a click reaches the URL, the URL reaches the server, and the printout is taken
// from the same answer the screen is showing.
//
// „Kasa główna Bartek" is the surface because it is the one that carries both halves — several
// hundred transactions (many pages) and the „Drukuj" button, which the dashboard does not render.
test.use({ storageState: 'e2e/.auth/user.json' })

const amounts = async (page: Page): Promise<number[]> =>
  (await readColumn(page, 'Kwota')).map((text) => {
    const [amount] = text.match(/-?[\d\s]+,\d{2}/) ?? []
    if (!amount) throw new Error(`unreadable „Kwota" cell: ${text}`)
    return parsePln(amount)
  })

test('sortowanie obejmuje cały zbiór, a wydruk wychodzi z tej samej odpowiedzi co ekran', async ({
  page,
}) => {
  // Several full route renders plus a printout that refetches the whole register.
  test.slow()

  // The print window calls window.print(), which headless Chromium answers by blocking — and it
  // blocks the OPENER's transition, since that is where the call is made. Neutered before anything
  // can open a popup; the page under test is unaffected, it never prints itself.
  await page.context().addInitScript(() => {
    window.print = () => {}
  })

  const registerUrl = `/kasa/${EXPENSE_REGISTER.id}`
  await page.goto(registerUrl)

  // --- A header click reaches the URL, and from there the server ---
  const amountHeader = page.locator('table thead th').filter({ hasText: 'Kwota' }).first()
  await amountHeader.waitFor()
  await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0)
  await amountHeader.click()
  await page.waitForURL(/[?&]sort=-?amount\b/)

  // The direction is read back rather than assumed: which way the first click goes is TanStack's
  // call, and this spec is about the two orders agreeing, not about that default.
  const descending = new URL(page.url()).searchParams.get('sort') === '-amount'
  const firstPage = await amounts(page)
  expect(firstPage.length).toBeGreaterThan(1)
  const inOrder = [...firstPage].sort((a, b) => (descending ? b - a : a - b))
  expect(firstPage).toEqual(inOrder)

  // --- The order is computed over the whole filtered set, not over the fetched page ---
  // The page the server hands back second must continue the first one. A sort applied to the
  // already-loaded hundred rows would restart from the top here instead.
  const sortParam = new URL(page.url()).searchParams.get('sort') ?? ''
  await page.goto(`${registerUrl}?sort=${encodeURIComponent(sortParam)}&page=2`)
  const secondPage = await amounts(page)
  expect(secondPage.length).toBeGreaterThan(0)
  const boundary = firstPage[firstPage.length - 1]
  if (descending) expect(boundary).toBeGreaterThanOrEqual(secondPage[0])
  else expect(boundary).toBeLessThanOrEqual(secondPage[0])

  // --- „Drukuj" from this view: the same rows, in the same order ---
  // Back to the first page, so the printout's opening rows are the ones on screen: the printout is
  // the whole filtered set unpaginated, so page 1 is its prefix.
  await page.goto(`${registerUrl}?sort=${encodeURIComponent(sortParam)}`)
  const screenIds = await readColumn(page, 'ID')
  expect(screenIds.length).toBeGreaterThan(1)

  const printWindow = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Drukuj transakcje' }).click()
  const printout = await printWindow
  await printout.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0)

  // Read in one evaluate rather than row by row: the printout carries the whole register, and the
  // ID column's position is taken from its own header, exactly as on screen.
  const printedIds = await printout.evaluate((count: number) => {
    const labels = Array.from(document.querySelectorAll('thead th'), (th) => th.textContent?.trim())
    const index = labels.indexOf('ID')
    if (index < 0) throw new Error('no „ID" column in the printout')
    return Array.from(document.querySelectorAll('tbody tr'))
      .slice(0, count)
      .map((row) => row.children[index].textContent?.trim() ?? '')
  }, screenIds.length)

  expect(printedIds).toEqual(screenIds.map((text) => text.trim()))
})
