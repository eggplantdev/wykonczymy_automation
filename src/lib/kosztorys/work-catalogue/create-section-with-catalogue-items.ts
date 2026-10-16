import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { shiftDisplayOrderFrom } from '@/lib/kosztorys/display-order'
import { placeCatalogueItems } from '@/lib/kosztorys/work-catalogue/place-catalogue-items'
import type {
  NewSectionCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// The picker's list is a snapshot taken when the dialog opened — so the match is re-run here, where
// nothing can have moved since.
async function sectionIdByName(
  db: DbExecutorT,
  investmentId: number,
  name: string,
): Promise<number | undefined> {
  const res = await db.execute(sql`
    SELECT id FROM kosztorys_sections
    WHERE investment_id = ${investmentId} AND lower(btrim(name)) = lower(btrim(${name}))
    ORDER BY display_order, id
    LIMIT 1
  `)
  const row = res.rows[0]
  return row ? Number(row.id) : undefined
}

async function appendIntoSectionNamed(
  db: DbExecutorT,
  investmentId: number,
  sectionName: string,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<NewSectionCatalogueSliceT | undefined> {
  const existingId = await sectionIdByName(db, investmentId, sectionName)
  if (existingId === undefined) return undefined
  const owner = await sectionOwnerAndNextItemOrder(db, existingId)
  // Falling through to the create instead would mint a twin under a name that is already taken.
  if (!owner) throw new Error(`Sekcja ${existingId} zniknęła w trakcie zapisu.`)
  const slice = await placeCatalogueItems(db, owner, catalogueItems)
  return { ...slice, createdSection: false }
}

// THE CALLER OWNS THE TRANSACTION.
export async function createSectionWithCatalogueItems(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  sectionName: string,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<NewSectionCatalogueSliceT> {
  const db = await getDb(payload, req)

  const existing = await appendIntoSectionNamed(db, investmentId, sectionName, catalogueItems)
  if (existing) return existing

  await shiftDisplayOrderFrom(db, 'kosztorys-sections', investmentId, 0)
  // The lookup above is a bare SELECT and the transaction runs at READ COMMITTED, so two confirms of
  // one new nazwa both miss it and both create. The shift takes `FOR UPDATE` over the investment's
  // sekcje, so the second caller blocks here and this re-read sees the first one's row.
  const raced = await appendIntoSectionNamed(db, investmentId, sectionName, catalogueItems)
  if (raced) return raced

  const created = await payload.create({
    collection: 'kosztorys-sections',
    req,
    data: { investment: investmentId, name: sectionName, displayOrder: 0 },
  })

  const slice = await placeCatalogueItems(
    db,
    {
      investmentId,
      section: { id: created.id, name: sectionName, displayOrder: 0, color: null },
      nextDisplayOrder: 0,
    },
    catalogueItems,
  )
  return { ...slice, createdSection: true }
}
