import { execFileSync } from 'node:child_process'
import { type Browser } from '@playwright/test'
import { refreshData } from './wait'

export type ReconSeedT = {
  mismatch: number
  match: number
  matchName: string
  laborCostsNetFromKosztorys: number
}

// A subprocess rather than an import: pulling the Payload config graph into Playwright's module
// loader drags next/cache with it, which the loader cannot resolve.
export function runSeedScript<T>(packageScript: string, marker: string): T {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl)
    throw new Error(`[${packageScript}] DB_POSTGRES_URL_TEST is not set — refusing to seed`)
  const out = execFileSync('pnpm', [packageScript], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((row) => row.startsWith(`${marker}=`))
  if (!line) throw new Error(`[${packageScript}] seed emitted no ${marker} line:\n${out}`)
  return JSON.parse(line.slice(marker.length + 1)) as T
}

// `fetchReferenceData` is cached with no `revalidate`, and `kosztorys_v2` resolves its investment
// off that cache — so a freshly seeded investment 404s there until something invalidates it.
export async function refreshReferenceData(browser: Browser): Promise<void> {
  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await page.goto('/')
    await refreshData(page)
  } finally {
    await page.close()
  }
}

async function seedAndRefresh<T>(
  browser: Browser,
  packageScript: string,
  marker: string,
): Promise<T> {
  const seed = runSeedScript<T>(packageScript, marker)
  await refreshReferenceData(browser)
  return seed
}

export const seedReconInvestments = (browser: Browser): Promise<ReconSeedT> =>
  seedAndRefresh(browser, 'seed:kosztorys-recon', 'RECON_SEED')

export type GridSeedT = { live: number; writes: number }

export const seedGridInvestments = (browser: Browser): Promise<GridSeedT> =>
  seedAndRefresh(browser, 'seed:kosztorys-grid', 'GRID_SEED')

export type DeleteSeedT = {
  item: number
  section: number
  stage: number
}

export const seedDeleteInvestments = (browser: Browser): Promise<DeleteSeedT> =>
  seedAndRefresh(browser, 'seed:kosztorys-deletes', 'DELETE_SEED')

export type CatalogueSeedInvestmentT = { id: number; item: string; beta: string }

export type CatalogueSeedT = {
  save: CatalogueSeedInvestmentT
  insert: CatalogueSeedInvestmentT
}

export const seedCatalogueInvestments = (browser: Browser): Promise<CatalogueSeedT> =>
  seedAndRefresh(browser, 'seed:work-catalogue', 'CATALOGUE_SEED')

export type FleetSeedVehicleT = { id: number; registration: string }

export type FleetSeedT = {
  prefix: string
  costs: FleetSeedVehicleT
  exempt: FleetSeedVehicleT
}

export const seedFleet = (browser: Browser): Promise<FleetSeedT> =>
  seedAndRefresh(browser, 'seed:fleet', 'FLEET_SEED')
