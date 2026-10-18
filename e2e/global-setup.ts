import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium, type FullConfig } from '@playwright/test'
import { chromeLaunchOptions } from './chrome-launch'
import { login } from './support/auth'
import { refreshData } from './support/wait'

export const STORAGE_STATE = 'e2e/.auth/user.json'
export const SEEDS_FILE = 'e2e/.auth/seeds.json'

const SEEDS_MARKER = 'E2E_SEEDS='

// The seeder runs as a subprocess: importing it pulls the Payload config graph → next/cache, which
// Playwright's module loader can't resolve.
function seedSuite(): void {
  // An unset var would set DB_POSTGRES_URL to undefined and let the seed fall back to the dev DB.
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error('[global-setup] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:e2e-suite'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((row) => row.startsWith(SEEDS_MARKER))
  if (!line) throw new Error(`[global-setup] the seeder emitted no ${SEEDS_MARKER} line:\n${out}`)
  mkdirSync(dirname(SEEDS_FILE), { recursive: true })
  writeFileSync(SEEDS_FILE, line.slice(SEEDS_MARKER.length))
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  seedSuite()

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('[global-setup] no baseURL configured')

  const browser = await chromium.launch(chromeLaunchOptions)
  try {
    const page = await browser.newPage({ baseURL })
    await login(page)
    await page.context().storageState({ path: STORAGE_STATE })
    // Without it `kosztorys_v2` 404s on a seeded investment: it resolves off cached reference data.
    await page.goto('/szablony')
    await refreshData(page)
  } finally {
    await browser.close()
  }
}
