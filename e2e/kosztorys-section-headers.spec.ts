import { test, expect, type Page } from '@playwright/test'
import { type E2ESeedsT, readSeed } from './support/seeds'
import { GRID_VIEWPORT, sectionBands } from './drivers/kosztorys-grid'

test.use({ viewport: GRID_VIEWPORT })

let seed: E2ESeedsT['sectionHeaders']

test.beforeAll(() => {
  seed = readSeed('sectionHeaders')
})

// Bands and the spacer/„Razem" rows leave their gutter empty, so this is exactly the visible item numbering.
async function itemOrdinals(page: Page): Promise<string[]> {
  const texts = await page.locator('.dsg-row .dsg-cell-gutter').allTextContents()
  return texts.map((t) => t.trim()).filter(Boolean)
}

// Every section footer („Razem sekcja") carries the word too, so footers and the header row are
// excluded by class before the filter runs.
function totalsRow(page: Page) {
  return page
    .locator('.dsg-row:not(.dsg-row-header):not(.kosztorys-section-footer)')
    .filter({ hasText: 'Razem' })
    .first()
}

async function gotoEditor(page: Page): Promise<void> {
  await page.goto(`/inwestycje/${seed.investment}/kosztorys_v2`)
  await sectionBands(page).first().waitFor()
}

test('one band per section, carrying its name and item count', async ({ page }) => {
  await gotoEditor(page)
  await expect(sectionBands(page)).toHaveCount(seed.sections.length)

  for (const [index, section] of seed.sections.entries()) {
    const band = sectionBands(page).nth(index)
    // The name is an editable input, so it lives in `value` — no text node carries it.
    await expect(band.getByRole('textbox')).toHaveValue(section.name)
    await expect(band).toContainText(`${section.itemCount} poz.`)
  }
})

test('collapsing a section hides its items and leaves the rest at their document numbers', async ({
  page,
}) => {
  await gotoEditor(page)
  const total = seed.sections.reduce((sum, s) => sum + s.itemCount, 0)
  await expect
    .poll(() => itemOrdinals(page))
    .toEqual(Array.from({ length: total }, (_, i) => String(i + 1)))
  const totalsBefore = await totalsRow(page).innerText()

  // A DOM click on the band itself. A pointer click can't reach it: the band hugs its rename input
  // (`field-sizing: content`), so its box never settles for Playwright's stability wait, and its
  // centre is that input, whose own click is stopped from bubbling.
  const toggleBand = (title: string) =>
    sectionBands(page)
      .first()
      .locator(`[role="button"][title="${title}"]`)
      .evaluate((el: HTMLElement) => el.click())

  await toggleBand('Zwiń sekcję')

  await expect(sectionBands(page)).toHaveCount(seed.sections.length)
  await expect(sectionBands(page).first().getByRole('textbox')).toHaveValue(seed.sections[0].name)
  const hidden = seed.sections[0].itemCount
  await expect
    .poll(() => itemOrdinals(page))
    .toEqual(Array.from({ length: total - hidden }, (_, i) => String(hidden + i + 1)))
  // `useInnerText` because the expectation was captured with `innerText()` — the default compares
  // normalized textContent, where the same row reads as one unbroken run of digits.
  await expect(totalsRow(page)).toHaveText(totalsBefore, { useInnerText: true })

  await toggleBand('Rozwiń sekcję')
  await expect.poll(() => itemOrdinals(page)).toHaveLength(total)
})
