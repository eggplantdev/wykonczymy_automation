import { execFileSync } from 'node:child_process'
import { expect, type Browser, type Locator, type Page } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'
import { formatPLN } from '@/lib/utils/format-currency'

// Give React a chance to hydrate `locator`'s element before the spec clicks or types into it.
// Before hydration a click is a no-op (or a native GET submit that never reaches its handler), and
// a controlled input is reset to empty. Crossing Next.js root layouts — (auth) /zaloguj →
// (frontend) / — is a full document load that re-hydrates from scratch, so waiting matters.
//
// This is a PRECONDITION, never a verdict: React stamping a `__reactFiber$…` key on a host node is
// an internal, and it has been observed missing on elements that click perfectly well a moment
// later. A test that failed here blamed the framework's bookkeeping instead of the interaction it
// exists to prove, so the timeout warns and returns — the click or fill that follows is what fails,
// with a message about the thing the spec is actually about.
//
// The poll runs on the DRIVER, one short-lived evaluate per tick, because an in-page timer cannot
// bound itself: `evaluate`'s own timeout covers resolving the locator, not awaiting a promise the
// page function returns, so a page whose timers never fire made this call eat the whole test budget
// and then blame the locator. Re-resolving each tick also survives React replacing the node.
const HYDRATION_TIMEOUT_MS = 20_000
const HYDRATION_POLL_MS = 250

export async function waitForHydration(locator: Locator): Promise<void> {
  const deadline = Date.now() + HYDRATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const hydrated = await locator
      .evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactFiber$')))
      .catch(() => false)
    if (hydrated) return
    await new Promise((resolve) => setTimeout(resolve, HYDRATION_POLL_MS))
  }
  console.warn(
    `waitForHydration: no __reactFiber$ key after ${HYDRATION_TIMEOUT_MS}ms — proceeding, the next interaction decides`,
  )
}

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

// Real long-standing entities the expense specs select. They exist in the standard Neon→local
// dump; `pnpm db:import:test` restores them into the 5435 test DB. If a future dump drops them,
// update here.
export const EXPENSE_REGISTER = { id: 5, name: 'Kasa główna Bartek' }
export const EXPENSE_INVESTMENT = 'Plac Hallera 6'
export const EXPENSE_CATEGORY = 'Materiały budowlane'

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

export async function readRegisterBalance(page: Page): Promise<number> {
  const balanceText = page.getByText(/Saldo:/).first()
  await balanceText.waitFor()
  return parsePln((await balanceText.textContent()) ?? '')
}

// Read the balance once it has settled. On a cold register load the value can change after the
// first paint (SSR value → client revalidation), so a single readRegisterBalance captures a stale baseline
// and a later "did it revert?" comparison fails against a number that was never really current.
export async function readRegisterBalanceStable(page: Page): Promise<number> {
  let previous = NaN
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await readRegisterBalance(page)
    // NaN never equals itself, so an unparseable balance can never satisfy the settle
    // check — guard it explicitly rather than looping 20× and returning NaN.
    if (!Number.isNaN(current) && current === previous) return current
    previous = current
    await page.waitForTimeout(150)
  }
  throw new Error(
    `readRegisterBalanceStable: balance never settled after 20 reads (last read: ${previous})`,
  )
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

// „Typ wydatku" is a Radix Select, so it opens a listbox rather than accepting `selectOption`.
export async function pickExpenseType(page: Page, label: string): Promise<void> {
  await page.getByLabel('Typ wydatku', { exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

// The global-nav „Wydatek" dialog, opened and nothing more — for a caller that only wants to read
// one of its pickers rather than book anything.
export async function openExpenseDialog(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  await trigger.click()
  await page.getByText('Nowy wydatek').first().waitFor()
}

// Open the global-nav "Wydatek" dialog and fill one line item against the shared
// investment/register/category, WITHOUT submitting — for a caller that wants to assert the form
// itself (a gated field, an inline error) before deciding whether to save.
export async function openInvestmentExpenseForm(
  page: Page,
  amount: string,
  description: string,
  netAmount?: string,
): Promise<void> {
  await openExpenseDialog(page)
  // The netto type has to be picked BEFORE the rest: switching type blanks the top-level fields.
  if (netAmount !== undefined) await pickExpenseType(page, 'Wydatek inwestycyjny netto')
  await pickComboOption(page, 'Inwestycja', EXPENSE_INVESTMENT)
  await pickComboOption(page, 'Kasa', EXPENSE_REGISTER.name)
  // The row's amount label is „Kwota" alone and „Brutto" once a netto figure sits beside it.
  await page
    .getByLabel(netAmount === undefined ? 'Kwota' : 'Brutto')
    .first()
    .fill(amount)
  if (netAmount !== undefined) await page.getByLabel('Netto').first().fill(netAmount)
  await page.locator('[id="lineItems[0].description"]').fill(description)
  await pickComboOption(page, 'Typ wydatku inwestycyjnego', EXPENSE_CATEGORY)
  // Only the netto type stores how the faktura was paid (`carriesPaymentMethod`), and the form
  // deliberately offers no default — „Gotówka" preselected would make the column mean „gotówka albo
  // nikt nie pytał". So the netto branch has to answer it, or the submit is refused and the dialog
  // simply stays open. Picked last: switching type blanks the top-level fields, and this is one.
  if (netAmount !== undefined) {
    await page.getByLabel('Metoda płatności', { exact: true }).click()
    await page.getByRole('option', { name: 'Gotówka', exact: true }).click()
  }
}

// The same dialog, submitted. Resolves once it has closed — which only happens on a successful
// write, so the close IS the proof the action was accepted.
export async function createInvestmentExpense(
  page: Page,
  amount: string,
  description: string,
  netAmount?: string,
): Promise<void> {
  await openInvestmentExpenseForm(page, amount, description, netAmount)
  await submitExpenseForm(page)
  await waitForExpenseDialogToClose(page)
}

// The dialog closes only on a successful action, so it staying open IS the failure — but „element is
// still visible" names nothing, and the dialog is holding the answer on screen the whole time. Read
// the field errors and the toast out of it and fail with those instead.
async function waitForExpenseDialogToClose(page: Page): Promise<void> {
  const title = page.getByText('Nowy wydatek').first()
  try {
    await title.waitFor({ state: 'hidden' })
  } catch (cause) {
    const complaints = await page
      .getByRole('dialog')
      .locator('[data-slot=field-error], .text-destructive')
      .allTextContents()
    const toast = await page.locator('.Toastify__toast').allTextContents()
    const said = [...complaints, ...toast].map((text) => text.trim()).filter(Boolean)
    throw new Error(
      said.length > 0
        ? `„Nowy wydatek" refused the submit: ${said.join(' | ')}`
        : '„Nowy wydatek" stayed open and said nothing — the action failed silently',
      { cause },
    )
  }
}

// `exact`, because „Zapisz jako domyślną kasę" sits in the same dialog and only stores a preference.
export async function submitExpenseForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
}

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
export const discountSection = (page: Page) =>
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

// „Bilans inwestora" is a SignedMoneyDisplay, and its element also carries the „(wybranych 5/5)"
// counter — which parsePln would happily fold into the number. Cut the counter off first.
export async function readInvestorBalance(page: Page): Promise<number> {
  const summary = page.getByText(/Bilans inwestora:/).first()
  await summary.waitFor()
  return parsePln(((await summary.textContent()) ?? '').replace(/\(wybranych.*/, ''))
}

// Fold the editor's Podsumowanie away. It opens to full height OVER the grid, so while it is open
// every click meant for a cell lands on the panel instead. Its toggle stacks both labels in one
// button — the accessible name carries „Pokaż" and „Schowaj" at once — so the panel's own
// Collapsible `data-state` is the only honest read of which way it currently is.
export async function collapseSummaryPanel(page: Page): Promise<Locator> {
  const toggle = page.getByRole('button', { name: /podsumowanie/i }).first()
  const panel = page.locator('.shadow-panel[data-state]').first()
  await panel.waitFor()
  // Already folded — a spec that reloads mid-test meets it that way, the preference being persisted.
  if ((await panel.getAttribute('data-state')) === 'closed') return toggle
  // The toggle renders DISABLED („Kosztorys jest pusty") until the tree arrives, and a click issued
  // in that window neither fails nor fires — it sits on actionability and swallows the whole retry
  // budget below. Wait the disabled state out before the first click.
  await expect(toggle).toBeEnabled({ timeout: 30_000 })
  // A dispatched event on a button React has not claimed yet is swallowed in silence, and the panel
  // then covers every cell the spec goes on to click.
  await waitForHydration(toggle)
  // `dispatchEvent`, not `click`: a real click waits for the renderer to be quiet, and over a grid
  // this wide it is not quiet for seconds at a time — the click then times out although the handler
  // it would have run is perfectly fine. Folding the panel away is setup, never the behaviour under
  // test, so the synthetic event costs nothing. Retried because a dispatch before hydration lands on
  // a button with no handler yet, and that one lost click leaves the panel covering every later cell.
  await expect(async () => {
    if ((await panel.getAttribute('data-state')) === 'open') await toggle.dispatchEvent('click')
    await expect(panel).toHaveAttribute('data-state', 'closed', { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  return toggle
}

// The mirror of `collapseSummaryPanel`, for a caller that wants to READ the panel: closed, it is
// `forceMount`ed but invisible, so `readSummaryFigures` needs it open.
export async function expandSummaryPanel(page: Page): Promise<void> {
  const toggle = await collapseSummaryPanel(page)
  const panel = page.locator('.shadow-panel[data-state]').first()
  await expect(async () => {
    if ((await panel.getAttribute('data-state')) === 'closed') await toggle.dispatchEvent('click')
    await expect(panel).toHaveAttribute('data-state', 'open', { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
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

export type ReconSeedT = {
  mismatch: number
  match: number
  matchName: string
  laborCostsNetFromKosztorys: number
}

// Run a seed script against the TEST database and parse the one machine-readable line it prints.
// A subprocess rather than an import: pulling the Payload config graph into Playwright's module
// loader drags next/cache with it, which the loader cannot resolve.
export function runSeedScript<T>(packageScript: string, marker: string): T {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error(`[${packageScript}] DB_POSTGRES_URL_TEST is not set — refusing to seed`)
  const out = execFileSync('pnpm', [packageScript], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((row) => row.startsWith(`${marker}=`))
  if (!line) throw new Error(`[${packageScript}] seed emitted no ${marker} line:\n${out}`)
  return JSON.parse(line.slice(marker.length + 1)) as T
}

// Make rows written from outside the server process visible to it. `fetchReferenceData` is cached
// with no `revalidate`, and `kosztorys_v2` resolves its investment off that cache — so a freshly
// seeded investment 404s there until something invalidates it. „Odśwież dane" is that something,
// and here it is SETUP: it runs before any measurement, so a spec that forbids a manual refresh
// between its own write and its own read may still call this.
export async function refreshReferenceData(browser: Browser): Promise<void> {
  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await page.goto('/')
    const refresh = page.getByRole('button', { name: 'Odśwież dane' })
    await waitForHydration(refresh)
    await refresh.click()
    await page.getByText('Dane odświeżone').waitFor()
  } finally {
    await page.close()
  }
}

// Each run creates fresh investments (the test DB is never reset), so two specs seeding this do not
// collide.
export async function seedReconInvestments(browser: Browser): Promise<ReconSeedT> {
  const seed = runSeedScript<ReconSeedT>('seed:kosztorys-recon', 'RECON_SEED')
  await refreshReferenceData(browser)
  return seed
}

// Two fresh investments of one shape — see seed-kosztorys-grid.ts. The test DB is never reset, so a
// spec that types into the grid gets its own investment and never sees what another one typed.
export type GridSeedT = { live: number; writes: number }

export async function seedGridInvestments(browser: Browser): Promise<GridSeedT> {
  const seed = runSeedScript<GridSeedT>('seed:kosztorys-grid', 'GRID_SEED')
  await refreshReferenceData(browser)
  return seed
}

// One fresh investment per target, because every test here DELETES part of a rozpiska: sharing one
// would make each test depend on what the previous one left behind, and a dump investment would be
// left mutilated for every later spec.
export type DeleteSeedT = {
  item: number
  section: number
  stage: number
}

export async function seedDeleteInvestments(browser: Browser): Promise<DeleteSeedT> {
  const seed = runSeedScript<DeleteSeedT>('seed:kosztorys-deletes', 'DELETE_SEED')
  await refreshReferenceData(browser)
  return seed
}

// One fresh investment per test, each two sekcje deep — see seed-work-catalogue.ts. The prace carry
// the run's timestamp in their opis because the katalog prac is global and outlives the run.
export type CatalogueSeedInvestmentT = { id: number; item: string; beta: string }

export type CatalogueSeedT = {
  save: CatalogueSeedInvestmentT
  insert: CatalogueSeedInvestmentT
}

export async function seedCatalogueInvestments(browser: Browser): Promise<CatalogueSeedT> {
  const seed = runSeedScript<CatalogueSeedT>('seed:work-catalogue', 'CATALOGUE_SEED')
  await refreshReferenceData(browser)
  return seed
}

// Two fresh vehicles sharing one registration prefix — see seed-fleet.ts. The prefix is what the
// spec types into the search box to narrow the global listing down to its own fixture.
export type FleetSeedVehicleT = { id: number; registration: string }

export type FleetSeedT = {
  prefix: string
  costs: FleetSeedVehicleT
  exempt: FleetSeedVehicleT
}

export async function seedFleet(browser: Browser): Promise<FleetSeedT> {
  const seed = runSeedScript<FleetSeedT>('seed:fleet', 'FLEET_SEED')
  await refreshReferenceData(browser)
  return seed
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
  // Re-opened until an item is there, rather than waited on longer. A restore re-renders the whole
  // editor, and a click that lands mid-remount opens the menu onto a trigger that is replaced a
  // frame later — the menu goes with it, and no amount of waiting brings back a menu that already
  // closed. The page then looks exactly like one where the click never happened.
  await expect(async () => {
    await trigger.click()
    await expect(menuItem).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await menuItem.click()
}

export const versionsDrawer = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: 'Zapisane i automatyczne punkty przywracania' })

// Open the shared expense investment by clicking its listing row — the listing navigates by
// `getRowHref`, so this also resolves the id a spec then reads pages by, without hard-coding one a
// future dump could renumber.
export async function openExpenseInvestment(page: Page): Promise<number> {
  await page.goto('/inwestycje')
  const row = page
    .locator('table tbody tr')
    .filter({ has: page.getByText(EXPENSE_INVESTMENT, { exact: true }) })
    .first()
  await row.waitFor()
  await waitForHydration(row)
  await row.click()
  await page.waitForURL(/\/inwestycje\/\d+/)
  const id = Number(new URL(page.url()).pathname.split('/').pop())
  expect(Number.isInteger(id), `„${EXPENSE_INVESTMENT}" row did not open an investment page`).toBe(
    true,
  )
  return id
}
