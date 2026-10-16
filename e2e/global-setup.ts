import { execFileSync } from 'node:child_process'
import { chromium, type FullConfig } from '@playwright/test'
import { chromeLaunchOptions } from './chrome-launch'
import { login } from './support/auth'

export const STORAGE_STATE = 'e2e/.auth/user.json'

// The seeder runs as a subprocess: importing it pulls the Payload config graph → next/cache, which
// Playwright's module loader can't resolve.
export default async function globalSetup(config: FullConfig): Promise<void> {
  // An unset var would set DB_POSTGRES_URL to undefined and let the seed fall back to the dev DB.
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error('[global-setup] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  execFileSync('pnpm', ['seed:e2e'], {
    stdio: 'inherit',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('[global-setup] no baseURL configured')

  const browser = await chromium.launch(chromeLaunchOptions)
  try {
    const page = await browser.newPage({ baseURL })
    await login(page)
    await page.context().storageState({ path: STORAGE_STATE })
  } finally {
    await browser.close()
  }
}
