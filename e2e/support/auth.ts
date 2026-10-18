import { type Page } from '@playwright/test'
import { E2E_OWNER, type E2ECredentialsT } from '@/scripts/e2e-user-credentials'
import { waitForHydration } from './wait'

// Fills the controlled inputs only after hydration, or hydration resets them to empty.
export async function fillLoginForm(page: Page, credentials: E2ECredentialsT): Promise<void> {
  await page.goto('/zaloguj')
  const emailField = page.getByLabel('Email')
  await waitForHydration(emailField)
  await emailField.fill(credentials.email)
  await page.getByLabel('Hasło').fill(credentials.password)
  await page.getByRole('button', { name: 'Zaloguj' }).click()
}

export async function login(page: Page): Promise<void> {
  await fillLoginForm(page, E2E_OWNER)
  await page.waitForURL('/')
}

// The dashboard redirects an EMPLOYEE straight to his own page.
export async function loginAsWorker(
  page: Page,
  credentials: E2ECredentialsT,
  workerId: number,
): Promise<void> {
  await fillLoginForm(page, credentials)
  await page.waitForURL(`/pracownicy/${workerId}`)
}
