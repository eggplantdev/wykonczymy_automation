import { test, expect, type Page } from '@playwright/test'
import { refreshReferenceData, runSeedScript } from './support/seeds'

test.use({ storageState: 'e2e/.auth/user.json' })

type BandsSeed = {
  investment: number
  sections: { name: string; net: number; itemCount: number }[]
}

let seed: BandsSeed

// The seeded investment 404s on kosztorys_v2 until `fetchReferenceData`'s cache is busted — the
// route resolves the investment off that cache, not off the DB.
test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<BandsSeed>('seed:kosztorys-bands', 'BANDS_SEED')
  await refreshReferenceData(browser)
})

function bands(page: Page) {
  return page.locator('.dsg-row.kosztorys-section-header')
}

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
  await bands(page).first().waitFor()
}

test('one band per section, carrying its name and item count', async ({ page }) => {
  await gotoEditor(page)
  await expect(bands(page)).toHaveCount(seed.sections.length)

  for (const [index, section] of seed.sections.entries()) {
    const band = bands(page).nth(index)
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
    bands(page)
      .first()
      .locator(`[role="button"][title="${title}"]`)
      .evaluate((el: HTMLElement) => el.click())

  await toggleBand('Zwiń sekcję')

  await expect(bands(page)).toHaveCount(seed.sections.length)
  await expect(bands(page).first().getByRole('textbox')).toHaveValue(seed.sections[0].name)
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
