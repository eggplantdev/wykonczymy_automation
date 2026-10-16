import { expect, type Browser, type Page } from '@playwright/test'
import { waitForHydration } from '../support/wait'

/**
 * „Udostępnij" mints on the click only when the investment has no link, and otherwise copies the one
 * it has — and a copied link is a token another spec also holds.
 */
export async function mintShareToken(page: Page, investmentId: number): Promise<string> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  const investorMenu = page.getByRole('button', { name: 'Inwestor' })
  await investorMenu.waitFor()
  await waitForHydration(investorMenu)
  await investorMenu.click()
  await page.getByRole('menuitem', { name: /^Udostępnij/ }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Udostępnij inwestorowi' })
  const linkField = dialog.getByRole('textbox')
  await expect(linkField).toHaveValue(/\/k\/.+/)
  const stale = await linkField.inputValue()
  await dialog.getByRole('button', { name: 'Wygeneruj nowy' }).click()
  await expect(linkField).not.toHaveValue(stale)
  return (await linkField.inputValue()).split('/k/')[1]
}

/**
 * A context built here inherits nothing from a spec's `test.use`, so it carries no payload-token
 * cookie.
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
