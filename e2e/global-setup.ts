import { execFileSync } from 'node:child_process'
import { chromium, type FullConfig } from '@playwright/test'
import { login } from './helpers'

export const STORAGE_STATE = 'e2e/.auth/user.json'

// Runs once, after the webServer is up. Seeds the OWNER user, then drives the real login UI
// to capture an authenticated storageState the auth'd specs reuse — the HTTP-only
// payload-token cookie can't be forged from JS, so a real login is the only way in.
//
// The seeder runs as a subprocess (not a direct import): importing it pulls the Payload
// config graph → next/cache, which Playwright's module loader can't resolve. `pnpm seed:e2e`
// runs under tsx where that resolves fine, and it's idempotent.
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Seed into the SAME isolated test DB the webServer uses (5435), not the dev DB on 5433.
  // seed:e2e's `node --env-file=.env` won't clobber this — an env var already set in the
  // process takes precedence over the .env file. Re-assert the test URL here rather than
  // trust the playwright.config throw + load order: an unset var would set DB_POSTGRES_URL
  // to undefined and let the seed fall back to the dev DB.
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error('[global-setup] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  execFileSync('pnpm', ['seed:e2e'], {
    stdio: 'inherit',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('[global-setup] no baseURL configured')

  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const page = await browser.newPage({ baseURL })
    await login(page)
    await page.context().storageState({ path: STORAGE_STATE })
  } finally {
    await browser.close()
  }
}
