import { type Locator, type Page } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'

// Wait until React has hydrated `locator`'s element, i.e. its onClick/onSubmit handler is
// attached. Before hydration a click/submit is a no-op (or triggers a native GET submit that
// never reaches its handler). React stamps hydrated DOM nodes with a __reactFiber$… key, so
// wait for that. Needed because crossing Next.js root layouts — (auth) /zaloguj → (frontend)
// / — is a full document load that re-hydrates from scratch, not a soft client navigation.
export async function waitForHydration(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    return new Promise<void>((resolve, reject) => {
      const isHydrated = () => Object.keys(element).some((key) => key.startsWith('__reactFiber$'))
      if (isHydrated()) return resolve()
      let waited = 0
      const timer = setInterval(() => {
        if (isHydrated()) {
          clearInterval(timer)
          resolve()
        } else if ((waited += 50) >= 10_000) {
          // Bounded so a never-hydrating element fails fast with a clear message
          // instead of hanging until the 120s test timeout.
          clearInterval(timer)
          reject(new Error('waitForHydration: element did not hydrate within 10s'))
        }
      }, 50)
    })
  })
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
export const EXPENSE_INVESTMENT = 'Plac Hellera 3'
export const EXPENSE_CATEGORY = 'Materiały budowlane'

// Parse a formatPLN string ("224 642,24 zł", spaces are non-breaking) into a number. Keeps a
// leading minus for negative saldo; strips the thousands spaces and the "zł" suffix.
export function parsePln(text: string): number {
  return Number(text.replace(/[^\d,-]/g, '').replace(',', '.'))
}

// The SaldoDisplay value on a /kasa/[id] page.
export async function readSaldo(page: Page): Promise<number> {
  const saldo = page.getByText(/Saldo:/).first()
  await saldo.waitFor()
  return parsePln((await saldo.textContent()) ?? '')
}

// Read the saldo once it has settled. On a cold register load the value can change after the
// first paint (SSR value → client revalidation), so a single readSaldo captures a stale baseline
// and a later "did it revert?" comparison fails against a number that was never really current.
// Poll until two consecutive reads agree.
export async function readSaldoStable(page: Page): Promise<number> {
  let previous = NaN
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await readSaldo(page)
    // NaN never equals itself, so an unparseable saldo can never satisfy the settle
    // check — guard it explicitly rather than looping 20× and returning NaN.
    if (!Number.isNaN(current) && current === previous) return current
    previous = current
    await page.waitForTimeout(150)
  }
  throw new Error(`readSaldoStable: saldo never settled after 20 reads (last read: ${previous})`)
}

// Select an option in one of the expense form's Radix/cmdk comboboxes. The trigger's accessible
// name is its field label. We deliberately DON'T type into the cmdk search box: filtering churns
// the list so the option re-renders/detaches mid-click (or is never highlighted for Enter). The
// unfiltered list is static, so clicking the exact option is a stable, reliable onSelect.
async function pickComboOption(page: Page, label: string, optionText: string): Promise<void> {
  const popper = page.locator('[data-radix-popper-content-wrapper]').first()
  const trigger = page.getByLabel(label)
  // On a cold render the option can be clickable before cmdk has wired its onSelect, so the click
  // closes the popover without committing the value. Retry until the trigger reflects the choice.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Each combo is a Radix Popover; its exit animation keeps the popper wrapper mounted and
    // pointer-events locked, so the next trigger click hangs on "stable". Wait for full detach.
    await popper.waitFor({ state: 'detached' })
    try {
      // Bounded so a slow-to-render option fails fast into the next retry attempt,
      // instead of hanging on Playwright's default (test-timeout) action wait.
      await trigger.click({ timeout: 5_000 })
      await page
        .getByRole('option', { name: optionText, exact: true })
        .first()
        .click({ timeout: 2_000 })
    } catch {
      continue
    }
    await popper.waitFor({ state: 'detached' })
    const committed = await trigger
      .filter({ hasText: optionText })
      .waitFor({ timeout: 2000 })
      .then(() => true)
      .catch(() => false)
    if (committed) return
  }
  throw new Error(`pickComboOption: "${label}" never committed "${optionText}" after 5 attempts`)
}

// Open the global-nav "Wydatek" dialog and submit one INVESTMENT_EXPENSE line item against the
// shared investment/register/category. Resolves once the dialog has closed (submit succeeded).
export async function createInvestmentExpense(
  page: Page,
  amount: string,
  description: string,
): Promise<void> {
  const trigger = page.getByRole('button', { name: /Wydatek/ }).first()
  await trigger.waitFor()
  await waitForHydration(trigger)
  await trigger.click()

  await page.getByText('Nowy wydatek').first().waitFor()
  await pickComboOption(page, 'Inwestycja', EXPENSE_INVESTMENT)
  await pickComboOption(page, 'Kasa', EXPENSE_REGISTER.name)
  await page.getByLabel('Kwota').first().fill(amount)
  await page.locator('[id="lineItems[0].description"]').fill(description)
  await pickComboOption(page, 'Typ wydatku inwestycyjnego', EXPENSE_CATEGORY)

  await page.getByRole('button', { name: 'Dodaj', exact: true }).click()
  await page.getByText('Nowy wydatek').first().waitFor({ state: 'hidden' })
}
