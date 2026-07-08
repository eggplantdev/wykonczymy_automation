import { test, expect } from '@playwright/test'

// Harness smoke: proves the production server boots and the login page renders its
// form. Unauthenticated — no DB seeding — so it stays green regardless of local data.
// Auth-flow and mutation specs (which need a seeded Payload user) are a follow-up.
test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/zaloguj')

  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Hasło')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
})
