import { expect, type Browser, type Page } from '@playwright/test'
import { waitForHydration } from './helpers'

// Shared by every spec that drives the investor link. Extracted rather than copied: a spec that
// minted its token a slightly different way would be testing a path the real owner never walks.

/**
 * Mint a share token through the owner's real dialog rather than inserting a row — the action that
 * creates it is part of the path under test. Each test mints its own, so none depends on another.
 *
 * Note „Dalej" also SAVES the client-view settings shown on the dialog's first step, so a token
 * minted here carries whatever is currently stored (it is a no-op when nothing changed).
 */
export async function mintShareToken(page: Page, investmentId: number): Promise<string> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  // exact: „Opcje rozliczenia" in the totals panel matches the same prefix.
  const optionsMenu = page.getByRole('button', { name: 'Opcje', exact: true })
  await optionsMenu.waitFor()
  await waitForHydration(optionsMenu)
  await optionsMenu.click()
  await page.getByRole('menuitem', { name: 'Udostępnij' }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Udostępnij inwestorowi' })
  await dialog.getByRole('button', { name: 'Dalej' }).click()
  await dialog.getByRole('button', { name: 'Wygeneruj link' }).click()
  const linkField = dialog.getByRole('textbox')
  await expect(linkField).toHaveValue(/\/k\/.+/)
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
