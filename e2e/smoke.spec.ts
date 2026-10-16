import { test, expect } from '@playwright/test'

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/zaloguj')

  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Hasło')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zaloguj' })).toBeVisible()
})
