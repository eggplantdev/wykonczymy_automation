import { expect, type Locator, type Page } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'
import { formatPLN } from '@/lib/utils/format-currency'
import { waitForHydration } from './wait'

// Used by both global-setup (to capture storageState) and the auth spec. Fills the controlled
// inputs only after hydration, or hydration resets them to empty.
export async function login(page: Page): Promise<void> {
  await page.goto('/zaloguj')
  const emailField = page.getByLabel('Email')
  await waitForHydration(emailField)
  await emailField.fill(E2E_EMAIL)
  await page.getByLabel('Hasło').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Zaloguj' }).click()
  await page.waitForURL('/')
}

/**
 * Every listed row's cell under one column, read by the header the owner sees.
 *
 * The index comes off the rendered header rather than being pinned: column visibility and order are
 * a per-user setting, so a hard-coded position is one toggle away from reading the wrong figure and
 * still passing.
 */
export async function readColumn(page: Page, header: string): Promise<string[]> {
  const headers = page.locator('table thead th')
  await headers.first().waitFor()
  const index = (await headers.allTextContents()).findIndex((text) => text.trim() === header)
  if (index < 0) throw new Error(`no „${header}" column in the rendered table`)
  return page.locator(`table tbody tr td:nth-child(${index + 1})`).allTextContents()
}

// Parse a formatPLN string ("224 642,24 zł", spaces are non-breaking) into a number. Keeps a
// leading minus for a negative balance; strips the thousands spaces and the "zł" suffix.
export function parsePln(text: string): number {
  return Number(text.replace(/[^\d,-]/g, '').replace(',', '.'))
}

// Select an option in any of the forms' Radix/cmdk comboboxes — the trigger is found by its field
// label. We deliberately DON'T type into the cmdk search box: filtering churns the list so the
// option re-renders/detaches mid-click (or is never highlighted for Enter). The unfiltered list is
// static, so clicking the exact option is a stable, reliable onSelect.
// Bounded so a slow-to-render option fails fast into the next retry attempt instead of hanging on
// Playwright's default (test-timeout) action wait. Generous, because the bound is a retry trigger
// and not a performance assertion: at 5 s a loaded machine fails every attempt for no reason.
const ATTEMPT_TIMEOUT_MS = 15_000

export async function pickComboOption(
  page: Page,
  label: string,
  optionText: string,
): Promise<void> {
  const popper = page.locator('[data-radix-popper-content-wrapper]').first()
  const trigger = page.getByLabel(label)
  // On a cold render the option can be clickable before cmdk has wired its onSelect, so the click
  // closes the popover without committing the value. Retry until the trigger reflects the choice.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Each combo is a Radix Popover; its exit animation keeps the popper wrapper mounted and
    // pointer-events locked, so the next trigger click hangs on "stable". Wait for full detach.
    await popper.waitFor({ state: 'detached', timeout: ATTEMPT_TIMEOUT_MS })
    try {
      await trigger.click({ timeout: ATTEMPT_TIMEOUT_MS })
      await page
        .getByRole('option', { name: optionText, exact: true })
        .first()
        .click({ timeout: ATTEMPT_TIMEOUT_MS })
    } catch {
      // A failed option click leaves the popover OPEN, so the next attempt's detach wait sits on a
      // wrapper that will never unmount and burns the whole test timeout. That is how one missing
      // option — a fixture the dump no longer carries — reported itself for two months as an
      // animation-timing flake (EX-473). Close it, so the retries actually retry and the run ends
      // on this function's own „never committed" message instead.
      await page.keyboard.press('Escape')
      continue
    }
    await popper.waitFor({ state: 'detached' })
    const committed = await trigger
      .filter({ hasText: optionText })
      .waitFor({ timeout: ATTEMPT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false)
    if (committed) return
  }
  throw new Error(`pickComboOption: "${label}" never committed "${optionText}" after 5 attempts`)
}

// Strip every space a formatter may have put in — pl-PL groups thousands with a non-breaking space
// and Intl's PLN uses a narrow one, neither of which a spec should have to reproduce to compare.
export const bare = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '')

// A rendered money figure, compared stripped of every kind of space (see `bare`). `toContain` rather
// than equality: a cell often carries a label or a second plane's figure beside the one under test.
export async function expectMoney(locator: Locator, amount: number, why: string): Promise<void> {
  expect(bare((await locator.textContent()) ?? ''), why).toContain(bare(formatPLN(amount)))
}

// 100,00–999,99: under a thousand pl-PL groups nothing, so the rendered figure carries no
// non-breaking space and compares as typed. Random per run because the test DB is never reset and
// every run leaves its rows behind — what a spec reads back has to be its own booking.
export function uniqueAmount(): number {
  return (10_000 + Math.floor(Math.random() * 89_999)) / 100
}

// One cell of whatever DataTable is on screen, by row text and column header. The column index is
// read from the header row rather than hard-coded: every listing here lets the user reorder and hide
// columns, so a pinned index would make a spec fail on an unrelated column change instead of on the
// figure it watches.
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

// The same read against /inwestycje, navigating there first — every caller reads after a write, and
// a stale page would answer with the value from before it.
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
