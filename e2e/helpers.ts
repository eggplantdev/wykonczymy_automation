import { type Locator, type Page } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD } from '@/scripts/e2e-user-credentials'

// Wait until React has hydrated `locator`'s element, i.e. its onClick/onSubmit handler is
// attached. Before hydration a click/submit is a no-op (or triggers a native GET submit that
// never reaches its handler). React stamps hydrated DOM nodes with a __reactFiber$… key, so
// wait for that. Needed because crossing Next.js root layouts — (auth) /zaloguj → (frontend)
// / — is a full document load that re-hydrates from scratch, not a soft client navigation.
export async function waitForHydration(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    return new Promise<void>((resolve) => {
      const isHydrated = () => Object.keys(element).some((key) => key.startsWith('__reactFiber$'))
      if (isHydrated()) return resolve()
      const timer = setInterval(() => {
        if (isHydrated()) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    })
  })
}

// Drive the real login UI and resolve once the dashboard has rendered. Used by both
// global-setup (to capture storageState) and the auth spec. Fills the controlled inputs only
// after hydration, or hydration resets them to empty.
export async function login(page: Page): Promise<void> {
  await page.goto('/zaloguj')
  const emailField = page.getByLabel('Email')
  await waitForHydration(emailField)
  await emailField.fill(E2E_EMAIL)
  await page.getByLabel('Hasło').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Zaloguj' }).click()
  await page.waitForURL('/')
}
