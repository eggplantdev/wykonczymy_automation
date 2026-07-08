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
  execFileSync('pnpm', ['seed:e2e'], { stdio: 'inherit' })

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('[global-setup] no baseURL configured')

  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ baseURL })

  await login(page)

  await page.context().storageState({ path: STORAGE_STATE })
  await browser.close()
}
