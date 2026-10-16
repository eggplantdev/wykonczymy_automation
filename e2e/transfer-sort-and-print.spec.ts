import { test, expect, type Page } from '@playwright/test'
import { parsePln } from './support/money'
import { readColumn } from './support/table'
import { EXPENSE_REGISTER } from './drivers/expenses'

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
  test.slow()

  // The print window calls window.print(), which headless Chromium answers by blocking — and it
  // blocks the OPENER's transition, since that is where the call is made.
  await page.context().addInitScript(() => {
    window.print = () => {}
  })

  const registerUrl = `/kasa/${EXPENSE_REGISTER.id}`
  await page.goto(registerUrl)

  const amountHeader = page.locator('table thead th').filter({ hasText: 'Kwota' }).first()
  await amountHeader.waitFor()
  await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0)
  await amountHeader.click()
  await page.waitForURL(/[?&]sort=-?amount\b/)

  const descending = new URL(page.url()).searchParams.get('sort') === '-amount'
  const firstPage = await amounts(page)
  expect(firstPage.length).toBeGreaterThan(1)
  const inOrder = [...firstPage].sort((a, b) => (descending ? b - a : a - b))
  expect(firstPage).toEqual(inOrder)

  const sortParam = new URL(page.url()).searchParams.get('sort') ?? ''
  await page.goto(`${registerUrl}?sort=${encodeURIComponent(sortParam)}&page=2`)
  const secondPage = await amounts(page)
  expect(secondPage.length).toBeGreaterThan(0)
  const boundary = firstPage[firstPage.length - 1]
  if (descending) expect(boundary).toBeGreaterThanOrEqual(secondPage[0])
  else expect(boundary).toBeLessThanOrEqual(secondPage[0])

  await page.goto(`${registerUrl}?sort=${encodeURIComponent(sortParam)}`)
  const screenIds = await readColumn(page, 'ID')
  expect(screenIds.length).toBeGreaterThan(1)

  const printWindow = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Drukuj transakcje' }).click()
  const printout = await printWindow
  await printout.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0)

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
