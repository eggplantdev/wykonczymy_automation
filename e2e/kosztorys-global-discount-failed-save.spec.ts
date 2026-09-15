import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'

// EX-597 regression guard. A failed rabat save has to leave the panel describing the deal the data
// still holds: the mode select back on „Kwotowy", the block usable again, and one toast saying why.
// The bug this replaces silently broke all three at once — the optimistic value never committed, so
// its rollback was invisible, and the transition that owned both never completed, leaving „Opcje
// rozliczenia" permanently disabled. Only the browser sees that: the action returns the same failure
// either way, and the DB (correctly) never moved.
test.use({ storageState: 'e2e/.auth/user.json' })

let investment: number

test.beforeAll(() => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl) throw new Error('[discount-spec] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-bands'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('BANDS_SEED='))
  if (!line) throw new Error(`[discount-spec] seed emitted no BANDS_SEED line:\n${out}`)
  investment = JSON.parse(line.slice('BANDS_SEED='.length)).investment
})

function modeSelect(page: Page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Kwotowy|Wyłączony|%)$/ })
    .first()
}

async function pickMode(page: Page, label: string): Promise<void> {
  await modeSelect(page).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test('a failed rabat save restores the mode and leaves the block usable', async ({ page }) => {
  await page.goto(`/inwestycje/${investment}/kosztorys_v2`)
  await page.getByRole('button', { name: 'Opcje rozliczenia', exact: true }).click()

  await pickMode(page, 'Kwotowy')
  await expect(modeSelect(page)).toHaveText('Kwotowy')

  // Kill the write at the driver, not in page JS: a fetch monkeypatch installed from the page wedges
  // this app's main thread, which then reads as the very defect under test.
  await page.route('**/*', async (route) => {
    if (route.request().headers()['next-action']) return route.abort('failed')
    return route.continue()
  })
  await pickMode(page, 'Wyłączony')

  await expect(page.locator('.Toastify__toast')).toHaveText('Nie udało się zapisać rabatu')
  await expect(modeSelect(page)).toHaveText('Kwotowy')
  await expect(modeSelect(page)).toBeEnabled()

  // Still usable after the failure — the stuck-transition bug only showed up on the NEXT interaction.
  await page.unroute('**/*')
  await pickMode(page, 'Wyłączony')
  await expect(modeSelect(page)).toHaveText('Wyłączony')
})
