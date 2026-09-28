import { test, expect, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { bare } from './support/money'
import { settleWrites, waitForHydration } from './support/wait'
import { anonymousVisit, mintShareToken } from './drivers/share-link'
import { columnHeaders, commitCellValue, openEditor, rowCell } from './drivers/kosztorys-grid'

// What the owner decides in „Ustawienia podglądu inwestora" and what the investor's link actually
// serves are two different processes on two different sides of an unauthenticated route: the owner
// writes per-investment settings through a server action, the client's page is rendered by
// `getPreviewKosztorysByToken` with no session at all. Nothing in the app puts the two side by side
// — the owner's own „Podgląd" reuses the same projection, so a setting that never reached the stored
// config would look right there too. Only an anonymous browser on the real /k/<token> can say
// whether the decision landed (EX-696, EX-721).
//
// The wpłaty and wydatki lists below the grid are the second half of the same boundary (EX-681,
// EX-570): they carry figures and invoice pages that reach the client through the summary panel, and
// each list renders a DIFFERENT shape for a reader with no session — plain text where the owner gets
// links, and one expense dataset dropped outright. A unit test sees the projection function; it
// cannot see whether the client's page mounts the projected variant.
test.use({ storageState: 'e2e/.auth/user.json' })

type ClientShareSeed = {
  investment: number
  investmentName: string
  sectionName: string
  workedRow: string
  emptyRow: string
  filledStage: string
  emptyStage: string
  cashDeposit: { amount: number; date: string }
  transferDeposit: { amount: number; netAmount: number; date: string }
  grossExpense: { description: string; amount: number }
  netExpense: { description: string; amount: number; netAmount: number }
  categoryName: string
  settledExpense: { description: string; amount: number }
  invoiceFilename: string
}

let seed: ClientShareSeed

test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<ClientShareSeed>('seed:client-share', 'CLIENT_SHARE_SEED')
  await refreshReferenceData(browser)
})

const STAGE_SUM_COLUMN = COLUMN_LABELS.stageQtySum
const UNIT_COLUMN = COLUMN_LABELS.unit
const EMPTY_ROWS_CHECKBOX = /^Ukryj pozycje bez przedmiaru i bez wykonanej pracy/

// Executed robocizna: one priced pozycja at 10 × 100 zł with 3 done. The figure every assertion
// about „hiding an empty row moves no money" watches.
const EXECUTED_NET = 300

/**
 * One money figure, asserted against the whole client document with a left boundary.
 *
 * A bare `toContain` cannot fail here: the same document renders the investor's 12 300 zł wpłata,
 * and „12300,00" already contains „300,00" — so deleting the podsumowanie outright would leave both
 * assertions green off an unrelated figure.
 */
function expectNetInDocument(text: string, amount: number, label: string): void {
  const needle = bare(formatNet(amount)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  expect(bare(text), label).toMatch(new RegExp(`(^|\\D)${needle}`))
}

async function openClientViewSettings(page: Page) {
  await page.goto(`/inwestycje/${seed.investment}/kosztorys_v2`)
  // Serving the client is its own menu — „Opcje" holds the editing commands only.
  const investorMenu = page.getByRole('button', { name: 'Inwestor' })
  await investorMenu.waitFor()
  await waitForHydration(investorMenu)
  await investorMenu.click()
  // Non-exact: each menu item's accessible name is its label plus its description line.
  await page.getByRole('menuitem', { name: /Ustawienia podglądu/ }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Ustawienia podglądu inwestora' })
  // The dialog fetches its settings on open and renders „Wczytywanie…" until they land, so every
  // caller would otherwise race the read.
  await expect(dialog.getByRole('checkbox', { name: UNIT_COLUMN })).toBeVisible()
  return dialog
}

async function saveSettings(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: 'Ustawienia podglądu inwestora' })
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  await expect(dialog).toBeHidden()
}

// An etap reads as three headers — its ilość under the bare name, its wartości under the name plus a
// suffix — so „is this etap on the document" is any header that starts with its name.
const stageHeaders = (headers: string[], stage: string) =>
  headers.filter((header) => header === stage || header.startsWith(`${stage} `))

test('unticking a column and showing empty pozycje reach the link without moving a single figure', async ({
  page,
  browser,
  baseURL,
}) => {
  const dialog = await openClientViewSettings(page)
  await dialog.getByRole('checkbox', { name: UNIT_COLUMN }).uncheck()
  await saveSettings(page)
  const token = await mintShareToken(page, seed.investment)

  const hidden = await anonymousVisit(browser, baseURL, token)
  try {
    await expect(hidden.page.getByText(COLUMN_LABELS.description, { exact: true })).toBeVisible()
    await expect(hidden.page.getByText(UNIT_COLUMN, { exact: true })).toHaveCount(0)
    // „Ukryj pozycje…" defaults to on, so the pozycja with no przedmiar and no executed work is
    // absent from the client's document before anything is touched.
    await expect(hidden.page.getByText(seed.workedRow)).toBeVisible()
    await expect(hidden.page.getByText(seed.emptyRow)).toHaveCount(0)
    expectNetInDocument(
      await hidden.page.locator('body').innerText(),
      EXECUTED_NET,
      'wykonana robocizna przy ukrytych pustych pozycjach',
    )
  } finally {
    await hidden.close()
  }

  const reopened = await openClientViewSettings(page)
  await reopened.getByRole('checkbox', { name: EMPTY_ROWS_CHECKBOX }).uncheck()
  await saveSettings(page)

  const shown = await anonymousVisit(browser, baseURL, token)
  try {
    await expect(shown.page.getByText(seed.emptyRow)).toBeVisible()
    // The claim the checkbox's own description makes („ukrycie ich nie zmienia podsumowania"), and
    // the reason this test asserts a figure rather than only a row: a pozycja empty on both axes adds
    // zero to every total, so the money must read identically with it shown and hidden.
    expectNetInDocument(
      await shown.page.locator('body').innerText(),
      EXECUTED_NET,
      'wykonana robocizna przy pokazanych pustych pozycjach',
    )
    // The unticked column stayed unticked across a second save.
    await expect(shown.page.getByText(UNIT_COLUMN, { exact: true })).toHaveCount(0)
  } finally {
    await shown.close()
  }
})

test('the investor sees their own wpłaty as plain text, on the tor each one was paid on', async ({
  page,
  browser,
  baseURL,
}) => {
  const token = await mintShareToken(page, seed.investment)
  const { page: visitor, close } = await anonymousVisit(browser, baseURL, token)
  try {
    await expect(visitor.getByText('Lista wpłat')).toBeVisible()
    // Every route the heading and the dates link to on the owner's page sits behind a login the
    // investor does not have, so on this page they are text — a link here is a dead end at best.
    await expect(visitor.getByRole('link', { name: 'Lista wpłat' })).toHaveCount(0)

    const body = bare(await visitor.locator('body').innerText())
    // Gotówka: one kwota netto and „×" where a brutto would be — never a figure derived at VAT.
    expect(body).toContain(bare(formatNet(seed.cashDeposit.amount)))
    expect(body).toContain('Gotówka')
    // Przelew: both kwoty off the faktura, neither derived from the other.
    expect(body).toContain(bare(formatNet(seed.transferDeposit.netAmount)))
    expect(body).toContain(bare(formatNet(seed.transferDeposit.amount)))
    expect(body).toContain('Przelew')
    // Tryb mieszany is the one tryb where both formy coexist by design, so it owes the client the
    // per-forma split rather than one sum over two columns that never met.
    expect(body).toContain(bare('Wpłaty gotówką'))
    expect(body).toContain(bare('Wpłaty przelewem'))
  } finally {
    await close()
  }
})

test('the investor gets one brutto wydatki list with its faktury, and never the company plane', async ({
  page,
  browser,
  baseURL,
}) => {
  const token = await mintShareToken(page, seed.investment)
  const { page: visitor, close } = await anonymousVisit(browser, baseURL, token)
  try {
    await visitor.getByRole('radio', { name: 'Materiały', exact: true }).click()
    // The section opens by default, so a blind click CLOSED it — and every assertion below then raced
    // the 200 ms collapse animation, which keeps the content mounted while it shrinks. The trace shows
    // this test winning that race by one millisecond (last assertion 199 ms after the click) until a
    // loaded machine lost it. Toggle only when it is actually closed.
    const expensesToggle = visitor.getByRole('button', { name: 'Lista wydatków' })
    await expect(expensesToggle).toBeVisible()
    if ((await expensesToggle.getAttribute('aria-expanded')) !== 'true')
      await expensesToggle.click()
    await expect(expensesToggle).toHaveAttribute('aria-expanded', 'true')

    for (const name of [
      /Materiały brutto/,
      /Materiały rozliczane netto/,
      /Materiały wliczone w robociznę/,
    ])
      await expect(visitor.getByRole('radio', { name })).toHaveCount(0)

    // The company's own spend — material already priced into robocizna — is dropped wholesale rather
    // than merely unlinked.
    await expect(visitor.getByText(seed.grossExpense.description)).toBeVisible()
    await expect(visitor.getByText(seed.netExpense.description)).toBeVisible()
    await expect(visitor.getByText(seed.settledExpense.description)).toHaveCount(0)

    // Razem is what left the kasa: the netto invoice counts at its brutto.
    await expect(
      visitor
        .locator('tfoot')
        .getByText(formatNet(seed.grossExpense.amount + seed.netExpense.amount)),
    ).toBeVisible()
    // The breakdown above folds the netto invoice into its category.
    await expect(visitor.getByText(`${seed.categoryName} netto`, { exact: true })).toHaveCount(0)

    // The faktura is the thing the client actually came for, and it is packed in the browser off
    // publicly-readable media URLs — which is the only reason the button can work with no session at
    // all. If media ever stopped being public this is what would go red.
    const downloadPromise = visitor.waitForEvent('download')
    await visitor.getByRole('button', { name: 'Pobierz faktury' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^faktury-.*\.zip$/)
  } finally {
    await close()
  }
})

test('inwestor zwija sekcję na swoim linku, choć jego własny schowek pustych pozycji jest włączony', async ({
  page,
  browser,
  baseURL,
}) => {
  // EX-714/EX-715. Folds are session state — nothing persists them and nothing rides in the share
  // payload — so what crosses the boundary is the RULE: a fold is suppressed while a narrowing is on,
  // and the client's own hider must not count as one. It is engaged on every share by default, so the
  // regression made the chevron dead on every published link while looking alive (the band flips its
  // aria-expanded either way — only the rows tell the truth).
  const dialog = await openClientViewSettings(page)
  // Explicitly, not by default: the spec above leaves the tick off, and the whole point here is that
  // the hider IS engaged while the fold happens.
  await dialog.getByRole('checkbox', { name: EMPTY_ROWS_CHECKBOX }).check()
  await saveSettings(page)
  const token = await mintShareToken(page, seed.investment)

  const { page: visitor, close } = await anonymousVisit(browser, baseURL, token)
  try {
    // Podsumowanie otwiera się domyślnie i leży NA siatce (nieprzezroczysta nakładka na całą jej
    // wysokość), więc dopóki inwestor go nie schowa, do belki sekcji nie da się kliknąć.
    const panelToggle = visitor.getByRole('button', { name: 'Podsumowanie' })
    await panelToggle.waitFor()
    await waitForHydration(panelToggle)
    await panelToggle.click()

    const band = visitor.getByRole('button').filter({ hasText: seed.sectionName })
    // The hider is on: the empty pozycja is gone from the document the investor received.
    await expect(visitor.getByText(seed.workedRow)).toBeVisible()
    await expect(visitor.getByText(seed.emptyRow)).toHaveCount(0)
    await expect(band).toHaveAttribute('aria-expanded', 'true')

    await band.click()
    await expect(band).toHaveAttribute('aria-expanded', 'false')
    // The rows, not the chevron, are the assertion: under the regression the band still reported
    // itself collapsed while its prace stayed on screen.
    await expect(visitor.getByText(seed.workedRow)).toHaveCount(0)
    // A folded section still announces itself and its total — it is hidden, not removed.
    await expect(band).toBeVisible()

    await band.click()
    await expect(visitor.getByText(seed.workedRow)).toBeVisible()
  } finally {
    await close()
  }
})

// Owner, 2026-09-28: one column set for the investor, and a settlement column shows up only once
// there is something in it. The rule is computed per request from the rows the link serves, so the
// promise under test is that an entry the owner types reaches a link the investor already holds —
// with no setting touched and no new link.
test('an etap reaches the investor link with its first entry, and not before', async ({
  page,
  browser,
  baseURL,
}) => {
  const token = await mintShareToken(page, seed.investment)

  const before = await anonymousVisit(browser, baseURL, token)
  try {
    await expect(before.page.getByText(seed.workedRow)).toBeVisible()
    const headers = await columnHeaders(before.page)
    // The filled etap carries the settlement totals with it — the control that makes the empty
    // etap's absence mean „no entries" rather than „no settlement columns at all".
    expect(headers).toContain(STAGE_SUM_COLUMN)
    expect(stageHeaders(headers, seed.filledStage)).not.toEqual([])
    expect(stageHeaders(headers, seed.emptyStage)).toEqual([])
  } finally {
    await before.close()
  }

  await openEditor(page, seed.investment)
  // Waited out, not assumed: the link reads Postgres, and a visit taken before the save lands would
  // read the etap as empty and pass for the wrong reason on the negative above.
  await settleWrites(page, 1, async () => {
    await commitCellValue(await rowCell(page, seed.workedRow, seed.emptyStage), '2')
  })

  const after = await anonymousVisit(browser, baseURL, token)
  try {
    await expect(after.page.getByText(seed.workedRow)).toBeVisible()
    expect(stageHeaders(await columnHeaders(after.page), seed.emptyStage)).not.toEqual([])
  } finally {
    await after.close()
  }
})
