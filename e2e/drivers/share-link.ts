import { expect, type Browser, type Page } from '@playwright/test'
import { waitForHydration } from '../support/wait'

// Shared by every spec that drives the investor link. Extracted rather than copied: a spec that
// minted its token a slightly different way would be testing a path the real owner never walks.

/**
 * Mint a share token through the owner's real dialog rather than inserting a row — the action that
 * creates it is part of the path under test.
 *
 * „Udostępnij" mints on the click only when the investment has no link, and otherwise copies the one
 * it has. The test DB is never reset, so which of the two a spec lands on depends on the specs before
 * it — and a copied link is a token another spec also holds. Rotating with „Wygeneruj nowy" makes the
 * token this spec's own whichever way the click went.
 */
export async function mintShareToken(page: Page, investmentId: number): Promise<string> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  // „Udostępnij" lives in „Inwestor", not „Opcje" — serving the client is its own menu.
  const investorMenu = page.getByRole('button', { name: 'Inwestor' })
  await investorMenu.waitFor()
  await waitForHydration(investorMenu)
  await investorMenu.click()
  // Non-exact: each menu item's accessible name is its label plus its description line.
  await page.getByRole('menuitem', { name: /^Udostępnij/ }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Udostępnij inwestorowi' })
  const linkField = dialog.getByRole('textbox')
  // The click itself leaves a link behind: no field here means the mint-if-missing never ran.
  await expect(linkField).toHaveValue(/\/k\/.+/)
  // The old value has to be held and waited out — reading too early returns the link this click
  // just invalidated.
  const stale = await linkField.inputValue()
  await dialog.getByRole('button', { name: 'Wygeneruj nowy' }).click()
  await expect(linkField).not.toHaveValue(stale)
  return (await linkField.inputValue()).split('/k/')[1]
}

/**
 * A context built here inherits nothing from a spec's `test.use`, so it carries no payload-token
 * cookie — an investor opening the link in their own browser, which is the whole scenario.
 */
export async function anonymousVisit(
  browser: Browser,
  baseURL: string | undefined,
  token: string,
  prepare?: (page: Page) => Promise<void>,
): Promise<{ page: Page; status: number | undefined; close: () => Promise<void> }> {
  const context = await browser.newContext({ storageState: undefined, baseURL })
  const page = await context.newPage()
  await prepare?.(page)
  const response = await page.goto(`/k/${token}`)
  return { page, status: response?.status(), close: () => context.close() }
}
