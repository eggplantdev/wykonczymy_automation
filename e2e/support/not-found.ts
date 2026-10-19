import { expect, type Page } from '@playwright/test'

// The status code is unassertable: `(frontend)/loading.tsx` flushes the shell at 200 before
// `notFound()` runs. Bounded well above the project's 20 s for the shell hydrating around it.
export async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByText('Nie znaleziono')).toBeVisible({ timeout: 60_000 })
}
