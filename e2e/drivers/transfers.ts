import { expect, type Page } from '@playwright/test'
import { parsePln } from '../support/money'
import { nudgeUntil, RETRY_STEP_MS, waitForHydration } from '../support/wait'

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

// The transfers table hides its filter block behind a collapsed „Filtry" section (fef44b45), and the
// „Suma wybranych transakcji" tile is rendered inside that block — so a closed section means the tile
// is not in the DOM at all, not merely off-screen. The open/closed choice is persisted in
// localStorage, so this is idempotent by necessity: the second call on a context that already opened
// it must not toggle it shut.
export async function openTransferFilters(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Filtry', exact: true })
  await trigger.waitFor()
  await waitForHydration(trigger)
  await nudgeUntil(
    async () => {
      if ((await trigger.getAttribute('aria-expanded', { timeout: RETRY_STEP_MS })) !== 'true') {
        await trigger.click({ timeout: RETRY_STEP_MS })
      }
    },
    () => expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: RETRY_STEP_MS }),
  )
}
