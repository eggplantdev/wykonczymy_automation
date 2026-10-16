import { expect, type Locator, type Page } from '@playwright/test'
import { parsePln } from '../support/money'
import { waitForHydration } from '../support/wait'
import { expandSummaryPanel } from './kosztorys-grid'

// Every figure in a summary panel lives in a `SummaryTable`, the only element in the app that sets
// `grid-template-columns` inline (`src/components/ui/summary-grid.tsx`).
export async function readSummaryFigures(page: Page): Promise<Record<string, string>> {
  const grids = page.locator('div[style*="grid-template-columns"]')
  await grids.first().waitFor()
  return grids.evaluateAll((nodes) => {
    const figures: Record<string, string> = {}
    for (const node of nodes) {
      const grid = node as HTMLElement
      // Computed, never the inline string: a track is `minmax(min(7rem, 24vw), 16rem)`, so splitting
      // what the author wrote counts one column as three and shifts every label into the wrong cell.
      const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length
      const cells = Array.from(grid.children)
      for (let index = 0; index + columns <= cells.length; index += columns) {
        const label = (cells[index].textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!label) continue
        // The settlement block is the page's headline and renders before any list it breaks down, so
        // the earlier row is the figure.
        if (label in figures) continue
        figures[label] = cells
          .slice(index + 1, index + columns)
          .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
          .join(' | ')
      }
    }
    return figures
  })
}

export async function openSettlementOptions(page: Page): Promise<void> {
  await expandSummaryPanel(page)
  await page.getByRole('button', { name: 'Opcje rozliczenia', exact: true }).click()
}

export const discountModeSelect = (page: Page) =>
  page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Kwotowy|Wyłączony|%)$/ })
    .first()

export async function pickDiscountMode(page: Page, label: string): Promise<void> {
  await discountModeSelect(page).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

const discountSection = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Rabat', exact: true }) })

async function commitDiscount(
  page: Page,
  field: (section: Locator) => Locator,
  value: number,
): Promise<void> {
  const section = discountSection(page)
  await field(section).fill(String(value))
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
}

export const applyDiscountAmount = (page: Page, net: number) =>
  commitDiscount(page, (section) => section.getByLabel(/netto/), net)

export const applyDiscountPercent = (page: Page, percent: number) =>
  commitDiscount(page, (section) => section.getByRole('textbox'), percent)

export async function openPanelView(page: Page, view: string): Promise<void> {
  const radio = page.getByRole('radio', { name: view, exact: true })
  await radio.waitFor()
  await waitForHydration(radio)
  if ((await radio.getAttribute('aria-checked')) !== 'true') await radio.click()
  await expect(radio).toHaveAttribute('aria-checked', 'true')
}

export async function ensureSettlementMode(
  page: Page,
  investmentId: number,
  mode: string,
): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  await openPanelView(page, 'Podsumowanie')
  const control = page
    .locator('div')
    .filter({ hasText: /^Rozliczenie robocizny/ })
    .last()
  const trigger = control.getByRole('combobox')
  await trigger.waitFor()
  await waitForHydration(trigger)
  // The tryb is read off the OPEN listbox, where Radix marks the current item `aria-selected` —
  // never off the trigger, whose label renders empty for as long as the panel is being re-fetched.
  await trigger.click()
  const selected = page.getByRole('option', { selected: true }).first()
  await selected.waitFor()
  if (((await selected.textContent()) ?? '').includes(mode)) {
    await page.keyboard.press('Escape')
    return
  }

  await page.getByRole('option', { name: mode, exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Potwierdź' }).click()
  await expect(trigger).toContainText(mode)
}

export async function readInvestorBalance(page: Page): Promise<number> {
  const summary = page.getByText(/Bilans inwestora:/).first()
  await summary.waitFor()
  return parsePln(((await summary.textContent()) ?? '').replace(/\(wybranych.*/, ''))
}
