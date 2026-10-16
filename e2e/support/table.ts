import { type Locator, type Page } from '@playwright/test'
import { parsePln } from './money'

export async function readColumn(page: Page, header: string): Promise<string[]> {
  const headers = page.locator('table thead th')
  await headers.first().waitFor()
  const index = (await headers.allTextContents()).findIndex((text) => text.trim() === header)
  if (index < 0) throw new Error(`no „${header}" column in the rendered table`)
  return page.locator(`table tbody tr td:nth-child(${index + 1})`).allTextContents()
}

// every listing here lets the user reorder and hide columns, so a pinned index would make a spec
// fail on an unrelated column change instead of on the figure it watches.
export async function tableCell(page: Page, rowText: string, header: string): Promise<Locator> {
  const headers = page.locator('table thead th')
  await headers.first().waitFor()
  const headerTexts = await headers.allTextContents()
  const index = headerTexts.findIndex((text) => text.trim().startsWith(header))
  if (index < 0)
    throw new Error(`no „${header}" column on ${page.url()}: ${headerTexts.join(' | ')}`)

  const row = page.locator('table tbody tr').filter({ hasText: rowText }).first()
  await row.waitFor()
  return row.locator('td').nth(index)
}

export async function readListingCell(
  page: Page,
  investmentName: string,
  header: string,
): Promise<Locator> {
  await page.goto('/inwestycje')
  return tableCell(page, investmentName, header)
}

export async function readListingFigure(
  page: Page,
  investmentName: string,
  header: string,
): Promise<number> {
  const cell = await readListingCell(page, investmentName, header)
  return parsePln((await cell.textContent()) ?? '')
}
