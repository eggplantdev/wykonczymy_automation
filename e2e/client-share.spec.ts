import { test, expect, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { bare } from './support/money'
import { settleWrites, waitForHydration } from './support/wait'
import { anonymousVisit, mintShareToken } from './drivers/share-link'
import { columnHeaders, commitCellValue, openEditor, rowCell } from './drivers/kosztorys-grid'

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

// Executed robocizna: one priced pozycja at 10 × 100 zł with 3 done.
const EXECUTED_NET = 300

/**
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
  const investorMenu = page.getByRole('button', { name: 'Inwestor' })
  await investorMenu.waitFor()
  await waitForHydration(investorMenu)
  await investorMenu.click()
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
    // a pozycja empty on both axes adds zero to every total, so the money must read identically with
    // it shown and hidden.
    expectNetInDocument(
      await shown.page.locator('body').innerText(),
      EXECUTED_NET,
      'wykonana robocizna przy pokazanych pustych pozycjach',
    )
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
    await expect(visitor.getByRole('link', { name: 'Lista wpłat' })).toHaveCount(0)

    const body = bare(await visitor.locator('body').innerText())
    expect(body).toContain(bare(formatNet(seed.cashDeposit.amount)))
    expect(body).toContain('Gotówka')
    expect(body).toContain(bare(formatNet(seed.transferDeposit.netAmount)))
    expect(body).toContain(bare(formatNet(seed.transferDeposit.amount)))
    expect(body).toContain('Przelew')
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
    // the 200 ms collapse animation, which keeps the content mounted while it shrinks.
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

    await expect(visitor.getByText(seed.grossExpense.description)).toBeVisible()
    await expect(visitor.getByText(seed.netExpense.description)).toBeVisible()
    await expect(visitor.getByText(seed.settledExpense.description)).toHaveCount(0)

    // Razem is what left the kasa: the netto invoice counts at its brutto.
    await expect(
      visitor
        .locator('tfoot')
        .getByText(formatNet(seed.grossExpense.amount + seed.netExpense.amount)),
    ).toBeVisible()
    await expect(visitor.getByText(`${seed.categoryName} netto`, { exact: true })).toHaveCount(0)

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
    await expect(visitor.getByText(seed.workedRow)).toBeVisible()
    await expect(visitor.getByText(seed.emptyRow)).toHaveCount(0)
    await expect(band).toHaveAttribute('aria-expanded', 'true')

    await band.click()
    await expect(band).toHaveAttribute('aria-expanded', 'false')
    // The rows, not the chevron, are the assertion: under the regression the band still reported
    // itself collapsed while its prace stayed on screen.
    await expect(visitor.getByText(seed.workedRow)).toHaveCount(0)
    await expect(band).toBeVisible()

    await band.click()
    await expect(visitor.getByText(seed.workedRow)).toBeVisible()
  } finally {
    await close()
  }
})

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
