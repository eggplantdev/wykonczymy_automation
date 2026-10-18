import { getPayload, type Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import {
  CLEAN_INVESTMENT,
  EXPENSE_INVESTMENT,
  LOCKED_INVESTMENT,
  LOSS_INVESTMENT,
} from '@/scripts/e2e-dump-rows'
import { seedClientShare } from '@/scripts/seed-client-share'
import { seedE2eUser } from '@/scripts/seed-e2e-user'
import { seedE2eWorkers } from '@/scripts/seed-e2e-workers'
import { seedFleet } from '@/scripts/seed-fleet'
import { seedInvoiceIngest } from '@/scripts/seed-invoice-ingest'
import { seedKosztorysBands } from '@/scripts/seed-kosztorys-bands'
import { seedKosztorysDeletes } from '@/scripts/seed-kosztorys-deletes'
import { seedKosztorysGrid } from '@/scripts/seed-kosztorys-grid'
import { seedKosztorysPresets } from '@/scripts/seed-kosztorys-presets'
import { seedKosztorysReconciliation } from '@/scripts/seed-kosztorys-reconciliation'
import { seedKosztorysSort } from '@/scripts/seed-kosztorys-sort'
import { seedKosztorysStructure } from '@/scripts/seed-kosztorys-structure'
import { seedKosztorysUndo } from '@/scripts/seed-kosztorys-undo'
import { seedPanelFilterBlind } from '@/scripts/seed-panel-filter-blind'
import { seedWorkCatalogue } from '@/scripts/seed-work-catalogue'

// Raw SQL skips the unlock guard and sheet sync. Without it, the specs pinned to these rows break
// the day prod closes or trashes one and a dump carries that into the test DB.
async function restoreDumpInvestments(payload: Payload) {
  const db = await getDb(payload)
  const ids = [LOCKED_INVESTMENT.id, LOSS_INVESTMENT.id, CLEAN_INVESTMENT.id]
  await db.execute(sql`
    UPDATE investments SET status = 'active', trashed_at = NULL
    WHERE name = ${EXPENSE_INVESTMENT} OR id IN (${sql.join(ids, sql`, `)})
  `)
}

// One entry per consumer, never shared: every spec mutates what it is handed, so two specs on one
// investment would read each other's writes.
async function seedSuite(payload: Payload) {
  const ownerId = await seedE2eUser(payload)
  await restoreDumpInvestments(payload)
  return {
    clientShare: await seedClientShare(payload),
    depositGross: await seedKosztorysBands(payload),
    depositNet: await seedKosztorysBands(payload),
    fleet: await seedFleet(payload),
    invoiceIngest: await seedInvoiceIngest(payload, ownerId),
    panelFilters: await seedPanelFilterBlind(payload),
    listing: await seedKosztorysReconciliation(payload),
    sectionHeaders: await seedKosztorysBands(payload),
    deletes: await seedKosztorysDeletes(payload),
    discountFailedSave: await seedKosztorysBands(payload),
    discountOverrides: await seedKosztorysGrid(payload),
    gridWrites: await seedKosztorysGrid(payload),
    presets: await seedKosztorysPresets(payload),
    shareLink: await seedKosztorysBands(payload),
    sort: await seedKosztorysSort(payload),
    structure: await seedKosztorysStructure(payload),
    undo: await seedKosztorysUndo(payload),
    versions: await seedKosztorysReconciliation(payload),
    catalogue: await seedWorkCatalogue(payload),
    workers: await seedE2eWorkers(payload),
  }
}

export type E2ESeedsT = Awaited<ReturnType<typeof seedSuite>>

getPayload({ config })
  .then(seedSuite)
  .then((seeds) => {
    console.log(`E2E_SEEDS=${JSON.stringify(seeds)}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error('[seed-e2e-suite]', error)
    process.exit(1)
  })
