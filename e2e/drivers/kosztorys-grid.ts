import { expect, type Locator, type Page } from '@playwright/test'
import { nudgeUntil, RETRY_STEP_MS, waitForHydration } from '../support/wait'

// It opens to full height OVER the grid, so while it is open every click meant for a cell lands on
// the panel instead.
export async function collapseSummaryPanel(page: Page): Promise<Locator> {
  const toggle = await summaryPanelToggle(page)
  await settleSummaryPanel(page, toggle, 'closed')
  return toggle
}

export async function expandSummaryPanel(page: Page): Promise<void> {
  await settleSummaryPanel(page, await summaryPanelToggle(page), 'open')
}

const summaryPanel = (page: Page) => page.locator('.shadow-panel[data-state]').first()

async function summaryPanelToggle(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: /podsumowanie/i }).first()
  await summaryPanel(page).waitFor()
  await expect(toggle).toBeEnabled({ timeout: 30_000 })
  await waitForHydration(toggle)
  return toggle
}

// a real click waits for the renderer to be quiet, and over a grid this wide it is not quiet for
// seconds at a time — the click then times out.
async function settleSummaryPanel(
  page: Page,
  toggle: Locator,
  want: 'open' | 'closed',
): Promise<void> {
  const panel = summaryPanel(page)
  await nudgeUntil(
    async () => {
      if ((await panel.getAttribute('data-state', { timeout: RETRY_STEP_MS })) !== want) {
        await toggle.dispatchEvent('click', undefined, { timeout: RETRY_STEP_MS })
      }
    },
    () => expect(panel).toHaveAttribute('data-state', want, { timeout: RETRY_STEP_MS }),
  )
}

export async function openEditor(page: Page, investmentId: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  await collapseSummaryPanel(page)
}

// react-datasheet-grid virtualises COLUMNS as well as rows, so only the horizontal window is in the
// DOM.
const gridScroller = (page: Page) => page.locator('.dsg-container').first()

const renderedHeaders = async (page: Page): Promise<string[]> => {
  const headerCells = page.locator('.dsg-row.dsg-row-header .dsg-cell')
  await headerCells.first().waitFor()
  return (await headerCells.allTextContents()).map((text) => text.trim())
}

export async function columnHeaders(page: Page): Promise<string[]> {
  const scroller = gridScroller(page)
  await scroller.waitFor()
  await scroller.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
  const seen: string[] = []
  let left = -1
  for (;;) {
    for (const header of await renderedHeaders(page)) {
      if (header && !seen.includes(header)) seen.push(header)
    }
    const next = await scroller.evaluate(
      (el, from) => {
        el.scrollTo({ left: from + el.clientWidth * 0.6, behavior: 'instant' })
        return el.scrollLeft
      },
      Math.max(left, 0),
    )
    if (next <= left) return seen
    left = next
    await expect.poll(() => renderedHeaders(page)).not.toHaveLength(0)
  }
}

// a column at the window's edge moves the window when Playwright scrolls it into view for a click,
// and the index would then point at a different column.
export async function columnIndex(page: Page, header: string): Promise<number> {
  const scroller = gridScroller(page)
  await scroller.waitFor()
  await scroller.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
  let left = -1
  for (;;) {
    const headers = await renderedHeaders(page)
    if (headers.includes(header)) {
      await page
        .locator('.dsg-row.dsg-row-header .dsg-cell')
        .nth(headers.indexOf(header))
        .evaluate((el) => el.scrollIntoView({ inline: 'center', block: 'nearest' }))
      await expect.poll(() => renderedHeaders(page)).toContain(header)
      return (await renderedHeaders(page)).indexOf(header)
    }
    const next = await scroller.evaluate(
      (el, from) => {
        el.scrollTo({ left: from + el.clientWidth * 0.6, behavior: 'instant' })
        return el.scrollLeft
      },
      Math.max(left, 0),
    )
    if (next <= left) break
    left = next
  }
  throw new Error(`no „${header}" column in the editor: ${(await columnHeaders(page)).join(' | ')}`)
}

export const gridRow = (page: Page, text: string) =>
  page.locator('.dsg-row').filter({ hasText: text })

export async function rowCell(page: Page, rowText: string, header: string): Promise<Locator> {
  return gridRow(page, rowText)
    .locator('.dsg-cell')
    .nth(await columnIndex(page, header))
}

// An editable cell holds its figure in an `<input value>`, and its textContent is EMPTY — so a text
// assertion against a typed ilość passes only on the computed columns beside it, and reports the
// typed one as „".
export async function expectCellValue(cell: Locator, value: string): Promise<void> {
  await expect(cell.locator('input')).toHaveValue(
    new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  )
}

// The Enter goes to the INPUT, never to `page.keyboard`, which delivers to `document.activeElement`
// — and in this editor that is not reliably the cell being typed into.
export async function commitCellValue(cell: Locator, value: string): Promise<void> {
  await cell.click()
  const input = cell.locator('input')
  await input.fill(value)
  await input.press('Enter')
}

export async function editorCell(page: Page, header: string): Promise<Locator> {
  const index = await columnIndex(page, header)
  return page
    .locator(
      '.dsg-row:not(.dsg-row-header):not(.kosztorys-section-header):not(.kosztorys-section-footer)',
    )
    .first()
    .locator('.dsg-cell')
    .nth(index)
}

// Every „Opcje" entry renders its label AND its one-line explanation inside the item, so both land
// in its accessible name — which is why callers match on the explanation rather than on „Zapisz" /
// „Wczytaj", words the menu carries several of.
export const LOAD_VERSION_ITEM = /Przywróć kosztorys do wcześniej zapisanego stanu/

export async function pickKosztorysOption(page: Page, item: RegExp): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Opcje', exact: true })
  await trigger.waitFor()
  await waitForHydration(trigger)
  const menuItem = page.getByRole('menuitem', { name: item })
  // Unconditional nudge: a restore re-renders the whole editor, and a click that lands mid-remount
  // opens the menu onto a trigger replaced a frame later.
  await nudgeUntil(
    () => trigger.click({ timeout: RETRY_STEP_MS }),
    () => expect(menuItem).toBeVisible({ timeout: RETRY_STEP_MS }),
  )
  await menuItem.click()
}

export const versionsDrawer = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Zapisane i automatyczne punkty przywracania' })
