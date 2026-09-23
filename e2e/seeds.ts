import { execFileSync } from 'node:child_process'
import { type Browser } from '@playwright/test'
import { refreshData } from './support/wait'

export type ReconSeedT = {
  mismatch: number
  match: number
  matchName: string
  laborCostsNetFromKosztorys: number
}

// Run a seed script against the TEST database and parse the one machine-readable line it prints.
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

// Make rows written from outside the server process visible to it. `fetchReferenceData` is cached
// with no `revalidate`, and `kosztorys_v2` resolves its investment off that cache — so a freshly
// seeded investment 404s there until something invalidates it. „Odśwież dane" is that something,
// and here it is SETUP: it runs before any measurement, so a spec that forbids a manual refresh
// between its own write and its own read may still call this.
export async function refreshReferenceData(browser: Browser): Promise<void> {
  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await page.goto('/')
    await refreshData(page)
  } finally {
    await page.close()
  }
}

// Each run creates fresh investments (the test DB is never reset), so two specs seeding this do not
// collide.
export async function seedReconInvestments(browser: Browser): Promise<ReconSeedT> {
  const seed = runSeedScript<ReconSeedT>('seed:kosztorys-recon', 'RECON_SEED')
  await refreshReferenceData(browser)
  return seed
}

// Two fresh investments of one shape — see seed-kosztorys-grid.ts. The test DB is never reset, so a
// spec that types into the grid gets its own investment and never sees what another one typed.
export type GridSeedT = { live: number; writes: number }

export async function seedGridInvestments(browser: Browser): Promise<GridSeedT> {
  const seed = runSeedScript<GridSeedT>('seed:kosztorys-grid', 'GRID_SEED')
  await refreshReferenceData(browser)
  return seed
}

// One fresh investment per target, because every test here DELETES part of a rozpiska: sharing one
// would make each test depend on what the previous one left behind, and a dump investment would be
// left mutilated for every later spec.
export type DeleteSeedT = {
  item: number
  section: number
  stage: number
}

export async function seedDeleteInvestments(browser: Browser): Promise<DeleteSeedT> {
  const seed = runSeedScript<DeleteSeedT>('seed:kosztorys-deletes', 'DELETE_SEED')
  await refreshReferenceData(browser)
  return seed
}

// One fresh investment per test, each two sekcje deep — see seed-work-catalogue.ts. The prace carry
// the run's timestamp in their opis because the katalog prac is global and outlives the run.
export type CatalogueSeedInvestmentT = { id: number; item: string; beta: string }

export type CatalogueSeedT = {
  save: CatalogueSeedInvestmentT
  insert: CatalogueSeedInvestmentT
}

export async function seedCatalogueInvestments(browser: Browser): Promise<CatalogueSeedT> {
  const seed = runSeedScript<CatalogueSeedT>('seed:work-catalogue', 'CATALOGUE_SEED')
  await refreshReferenceData(browser)
  return seed
}

// Two fresh vehicles sharing one registration prefix — see seed-fleet.ts. The prefix is what the
// spec types into the search box to narrow the global listing down to its own fixture.
export type FleetSeedVehicleT = { id: number; registration: string }

export type FleetSeedT = {
  prefix: string
  costs: FleetSeedVehicleT
  exempt: FleetSeedVehicleT
}

export async function seedFleet(browser: Browser): Promise<FleetSeedT> {
  const seed = runSeedScript<FleetSeedT>('seed:fleet', 'FLEET_SEED')
  await refreshReferenceData(browser)
  return seed
}
