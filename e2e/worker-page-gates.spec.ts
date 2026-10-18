import { test, expect, type Page } from '@playwright/test'
import { E2E_WORKERS, workerCredentials } from '@/scripts/e2e-user-credentials'
import { WORKER_STORAGE_STATE } from './global-setup'
import { fillLoginForm, loginAsWorker } from './support/auth'
import { readSeed, type E2ESeedsT } from './support/seeds'
import { waitForHydration } from './support/wait'

// The status code is unassertable: `(frontend)/loading.tsx` flushes the shell at 200 before
// `notFound()` runs. Bounded well above the project's 20 s for the shell hydrating around it.
async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByText('Nie znaleziono')).toBeVisible({ timeout: 60_000 })
}

let workers: E2ESeedsT['workers']

test.beforeAll(() => {
  workers = readSeed('workers')
})

test.describe('logged out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('an EMPLOYEE lands on his own worker page after login', async ({ page }) => {
    await loginAsWorker(page, workerCredentials('self'), workers.self.id)

    await expect(page.getByRole('heading', { name: E2E_WORKERS.self.name })).toBeVisible()
  })

  test('an EMPLOYEE logs in with the e-mail he changed on his own page', async ({ page }) => {
    const credentials = workerCredentials('credentials')
    const newEmail = `e2e-worker-moved-${Date.now()}@wykonczymy.test`
    await loginAsWorker(page, credentials, workers.credentials.id)

    const trigger = page.getByRole('button', { name: 'Zmień e-mail lub hasło' })
    await waitForHydration(trigger)
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(newEmail)
    await dialog.getByLabel('Obecne hasło').fill(credentials.password)
    await dialog.getByRole('button', { name: 'Zapisz' }).click()
    await expect(page.getByText('Dane logowania zmienione')).toBeVisible()

    await page.getByRole('button', { name: 'Wyloguj' }).click()
    await page.waitForURL('**/zaloguj')

    await fillLoginForm(page, credentials)
    await expect(page.getByText('Nieprawidłowy email lub hasło')).toBeVisible()
    await loginAsWorker(page, { ...credentials, email: newEmail }, workers.credentials.id)
    await expect(page.getByRole('heading', { name: E2E_WORKERS.credentials.name })).toBeVisible()
  })
})

test.describe('logged in as an EMPLOYEE', () => {
  test.use({ storageState: WORKER_STORAGE_STATE })

  test("another worker's page renders the 404, not his data", async ({ page }) => {
    await page.goto(`/pracownicy/${workers.other.id}`)

    await expectNotFound(page)
    await expect(page.getByRole('heading', { name: E2E_WORKERS.other.name })).toHaveCount(0)
  })

  test('his own kasa page renders the 404 — /kasa is management-only', async ({ page }) => {
    await page.goto(`/kasa/${workers.self.registerId}`)

    await expectNotFound(page)
    await expect(page.getByRole('heading', { name: workers.self.registerName })).toHaveCount(0)
  })
})
