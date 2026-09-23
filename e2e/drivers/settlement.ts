import { expect, type Page } from '@playwright/test'
import { parsePln } from '../support/ui'
import { waitForHydration } from '../support/wait'
import { expandSummaryPanel } from './kosztorys-grid'

// Every figure in a summary panel lives in a `SummaryTable`, the only element in the app that sets
// `grid-template-columns` inline (`src/components/ui/summary-grid.tsx`) — a transfers table below it
// sets none, which is what keeps this read off the surfaces that follow the URL filters. Its cells
// are direct children of the grid (a row wrapper would break the shared gridlines), so the track
// count slices them back into label → values.
export async function readSummaryFigures(page: Page): Promise<Record<string, string>> {
  const grids = page.locator('div[style*="grid-template-columns"]')
  await grids.first().waitFor()
  return grids.evaluateAll((nodes) => {
    const figures: Record<string, string> = {}
    for (const node of nodes) {
      const grid = node as HTMLElement
      // Computed, never the inline string: a track is `minmax(min(7rem, 24vw), 16rem)`, so splitting
      // what the author wrote counts one column as three and shifts every label into the wrong cell.
      // The computed value is resolved pixel widths — one token per column, whatever the source says.
      const columns = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length
      const cells = Array.from(grid.children)
      for (let index = 0; index + columns <= cells.length; index += columns) {
        const label = (cells[index].textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!label) continue
        // First occurrence wins. This is one flat dict over EVERY grid on the page, and a detail
        // table's header row can open with the same word as a settlement figure — „Lista wpłat"
        // starts „Wpłaty | Netto | Brutto | Forma wpłaty", which sits below the settlement and so
        // overwrote the figure with its own column headers. The settlement block is the page's
        // headline and renders before any list it breaks down, so the earlier row is the figure.
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

// „Opcje rozliczenia" — the popover holding every set-once decision about the deal (tryb, VAT,
// materiały, rabat). Only `kosztorys_v2` mounts it; the investment page renders the same panel with
// no writer.
export async function openSettlementOptions(page: Page): Promise<void> {
  // The trigger sits in the panel's pinned bar and is UNMOUNTED while the Podsumowanie is folded —
  // so a spec that read its figures (which folds the panel again) would wait out the whole test on a
  // button that cannot appear.
  await expandSummaryPanel(page)
  await page.getByRole('button', { name: 'Opcje rozliczenia', exact: true }).click()
}

// The rabat mode select inside that popover. Found by the option set it can hold rather than by a
// label: the popover carries several comboboxes and none of them is labelled.
export const discountModeSelect = (page: Page) =>
  page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Kwotowy|Wyłączony|%)$/ })
    .first()

export async function pickDiscountMode(page: Page, label: string): Promise<void> {
  await discountModeSelect(page).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

// The rabat block of that popover, found by its heading — „Zapisz" and a bare number field sit in
// several of the blocks, so a spec typing a rabat has to say which block it means.
const discountSection = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Rabat', exact: true }) })

// Both rabat modes commit the same way: type, then „Zapisz". Nothing is written on blur — a rabat is
// a deal-level concession, so leaving the field must never be enough to change it.
export async function applyDiscountValue(page: Page, value: number): Promise<void> {
  const section = discountSection(page)
  await section.getByRole('textbox').fill(String(value))
  await section.getByRole('button', { name: 'Zapisz', exact: true }).click()
}

// The panel's view toggle is a radiogroup („Podsumowanie" / „Materiały" / „Marża"); the pick is
// persisted per user, so a spec that wants a given tab must select it rather than assume it.
export async function openPanelView(page: Page, view: string): Promise<void> {
  const radio = page.getByRole('radio', { name: view, exact: true })
  await radio.waitFor()
  await waitForHydration(radio)
  if ((await radio.getAttribute('aria-checked')) !== 'true') await radio.click()
  await expect(radio).toHaveAttribute('aria-checked', 'true')
}

// The tryb rozliczenia is an investment-level fact the dump ships as „Netto", and flipping it is a
// server action — which is also what makes the flip usable as a fixture: it invalidates the
// investments tag, so the reference data every other surface reads the mode from comes back fresh.
// No seed script can do that from outside the server process. Idempotent, so each test states the
// tryb it needs instead of inheriting it from the one before. Only `kosztorys_v2` offers the
// control: the investment page renders the same panel without a writer, so it shows no select.
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
  // Reading it empty would look like „not the tryb we want" and send this into a flip it must not
  // make: re-picking the value already selected fires no onValueChange, so no dialog ever opens and
  // the confirm click below waits out the whole test.
  await trigger.click()
  const selected = page.getByRole('option', { selected: true }).first()
  await selected.waitFor()
  if (((await selected.textContent()) ?? '').includes(mode)) {
    await page.keyboard.press('Escape')
    return
  }

  await page.getByRole('option', { name: mode, exact: true }).click()
  // Every setting whose consequence lands on the investor's link is staged behind this one dialog.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Potwierdź' }).click()
  await expect(trigger).toContainText(mode)
}

// „Bilans inwestora" is a SignedMoneyDisplay, and its element also carries the „(wybranych 5/5)"
// counter — which parsePln would happily fold into the number. Cut the counter off first.
export async function readInvestorBalance(page: Page): Promise<number> {
  const summary = page.getByText(/Bilans inwestora:/).first()
  await summary.waitFor()
  return parsePln(((await summary.textContent()) ?? '').replace(/\(wybranych.*/, ''))
}
