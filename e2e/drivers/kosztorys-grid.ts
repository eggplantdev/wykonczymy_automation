import { expect, type Locator, type Page } from '@playwright/test'
import { nudgeUntil, RETRY_STEP_MS, waitForHydration } from '../support/wait'

// Fold the editor's Podsumowanie away. It opens to full height OVER the grid, so while it is open
// every click meant for a cell lands on the panel instead. Its toggle stacks both labels in one
// button — the accessible name carries „Pokaż" and „Schowaj" at once — so the panel's own
// Collapsible `data-state` is the only honest read of which way it currently is.
export async function collapseSummaryPanel(page: Page): Promise<Locator> {
  const toggle = await summaryPanelToggle(page)
  await settleSummaryPanel(page, toggle, 'closed')
  return toggle
}

// The mirror of `collapseSummaryPanel`, for a caller that wants to READ the panel: closed, it is
// `forceMount`ed but invisible, so `readSummaryFigures` needs it open.
export async function expandSummaryPanel(page: Page): Promise<void> {
  await settleSummaryPanel(page, await summaryPanelToggle(page), 'open')
}

const summaryPanel = (page: Page) => page.locator('.shadow-panel[data-state]').first()

// The toggle, ready to be clicked — which is three separate waits, and every caller needs all three.
// It renders DISABLED („Kosztorys jest pusty") until the tree arrives, and a click issued in that
// window neither fails nor fires; and a dispatched event on a button React has not claimed yet is
// swallowed in silence, leaving the panel covering every cell the spec goes on to click.
async function summaryPanelToggle(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: /podsumowanie/i }).first()
  await summaryPanel(page).waitFor()
  await expect(toggle).toBeEnabled({ timeout: 30_000 })
  await waitForHydration(toggle)
  return toggle
}

// `dispatchEvent`, not `click`: a real click waits for the renderer to be quiet, and over a grid this
// wide it is not quiet for seconds at a time — the click then times out although the handler it would
// have run is perfectly fine. Opening or folding the panel is setup, never the behaviour under test,
// so the synthetic event costs nothing.
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

// The editor, with the Podsumowanie folded away — the state every grid spec needs before its first
// cell click.
export async function openEditor(page: Page, investmentId: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  await collapseSummaryPanel(page)
}

// react-datasheet-grid virtualises COLUMNS as well as rows, so only the horizontal window is in the
// DOM — a column two screens to the right simply is not there, and a spec reading the header row
// would conclude the editor never assembled it. Every reader below therefore drives the grid's own
// scroller rather than trusting one snapshot.
const gridScroller = (page: Page) => page.locator('.dsg-container').first()

const renderedHeaders = async (page: Page): Promise<string[]> => {
  const headerCells = page.locator('.dsg-row.dsg-row-header .dsg-cell')
  await headerCells.first().waitFor()
  return (await headerCells.allTextContents()).map((text) => text.trim())
}

// Sweep the whole width and merge the windows. Which columns exist is a per-user setting AND an
// investment-level one (a global rabat pulls the four rabat columns), so a spec asking whether a
// column is there has to ask the grid — but it has to ask all of it.
export async function columnHeaders(page: Page): Promise<string[]> {
  const scroller = gridScroller(page)
  await scroller.waitFor()
  // From the left edge, wherever a previous reader left it — a sweep that starts mid-grid would
  // report the columns before it as missing.
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

// Scroll a column into the middle of the grid and return its index among the cells CURRENTLY
// rendered — the only index a `.dsg-cell` nth() can be read with under column virtualisation. Body
// rows render the same window as the header, so the two line up. Centred rather than merely on
// screen: a column at the window's edge moves the window when Playwright scrolls it into view for a
// click, and the index would then point at a different column.
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

// A grid row found by text it alone carries — the seeds give prace and sekcje distinct descriptions
// for exactly this reason, since `hasText` matches substrings. Section bands and the „Razem" footer
// ride the grid as ordinary `.dsg-row`s, so a caller after an item row must say so by its text.
export const gridRow = (page: Page, text: string) =>
  page.locator('.dsg-row').filter({ hasText: text })

// One named row's cell in one column. The stage columns carry their whole header trigger, so the
// only honest read of a stage quantity is the body cell under it.
export async function rowCell(page: Page, rowText: string, header: string): Promise<Locator> {
  return gridRow(page, rowText)
    .locator('.dsg-cell')
    .nth(await columnIndex(page, header))
}

// An editable cell holds its figure in an `<input value>`, and its textContent is EMPTY — so a text
// assertion against a typed ilość passes only on the computed columns beside it, and reports the
// typed one as „". Substring semantics, matching what a reader expects of a cell assertion.
export async function expectCellValue(cell: Locator, value: string): Promise<void> {
  await expect(cell.locator('input')).toHaveValue(
    new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  )
}

// Commit a typed figure into the cell that is already open for editing.
//
// The Enter goes to the INPUT, never to `page.keyboard`, which delivers to `document.activeElement`
// — and in this editor that is not reliably the cell being typed into. An autosave's
// `router.refresh()` re-renders the grid mid-edit, the input unmounts, and focus falls back to
// whatever Radix last restored it to: in `kosztorys-global-discount-overrides` that was the
// discount-type menu trigger one cell over, so Enter OPENED that menu instead of committing. A Radix
// menu marks the rest of the document `aria-hidden`, so every later `getByRole` found nothing and the
// report blamed the toolbar button 30 s away. Pressing on the locator re-resolves and re-focuses the
// input, so the key can only reach the cell under edit.
export async function commitCellValue(cell: Locator, value: string): Promise<void> {
  // The click belongs here: `react-datasheet-grid` only mounts the `<input>` for the cell that is
  // active, so „select the cell" is not a caller's choice — it is the precondition for the two lines
  // below to have anything to address. Five call sites each repeated it and one of them would
  // eventually forget.
  await cell.click()
  const input = cell.locator('input')
  await input.fill(value)
  await input.press('Enter')
}

// The nth `.dsg-cell` of the first real item row, by column header. Section bands and the „Razem"
// footer ride the grid as ordinary `.dsg-row`s, so „the first non-header row" is a band unless they
// are excluded by class.
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
  // Unconditional nudge, unlike the guarded ones: a restore re-renders the whole editor, and a click
  // that lands mid-remount opens the menu onto a trigger replaced a frame later — the menu goes with
  // it, and the page then looks exactly like one where the click never happened.
  await nudgeUntil(
    () => trigger.click({ timeout: RETRY_STEP_MS }),
    () => expect(menuItem).toBeVisible({ timeout: RETRY_STEP_MS }),
  )
  await menuItem.click()
}

export const versionsDrawer = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Zapisane i automatyczne punkty przywracania' })
