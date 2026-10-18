import { type Locator, type Page } from '@playwright/test'
import { parsePln } from './money'

// A page can stack several tables (the dashboard puts pending zgłoszenia above the transfers), so
// every lookup is scoped to the one table that owns the header or the row.
async function columnIndex(
  table: Locator,
  header: string,
  matches: (text: string) => boolean,
): Promise<number> {
  const headers = table.locator('thead th')
  await headers.first().waitFor()
  const headerTexts = await headers.allTextContents()
  const index = headerTexts.findIndex((text) => matches(text.trim()))
  if (index < 0) throw new Error(`no „${header}" column: ${headerTexts.join(' | ')}`)
  return index
}

export async function readColumn(page: Page, header: string): Promise<string[]> {
  const table = page
    .locator('table')
    .filter({
      has: page.locator('thead th').filter({ hasText: new RegExp(`^\\s*${header}\\s*$`) }),
    })
    .first()
  const index = await columnIndex(table, header, (text) => text === header)
  return table.locator(`tbody tr td:nth-child(${index + 1})`).allTextContents()
}

// every listing here lets the user reorder and hide columns, so a pinned index would make a spec
// fail on an unrelated column change instead of on the figure it watches.
export async function tableCell(page: Page, rowText: string, header: string): Promise<Locator> {
  const table = page
    .locator('table')
    .filter({ has: page.locator('tbody tr', { hasText: rowText }) })
    .first()
  const row = table.locator('tbody tr', { hasText: rowText }).first()
  await row.waitFor()
  const index = await columnIndex(table, header, (text) => text.startsWith(header))
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
