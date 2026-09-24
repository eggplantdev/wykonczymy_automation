import { type Page } from '@playwright/test'

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
