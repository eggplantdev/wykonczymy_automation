import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { shiftDisplayOrderFrom } from '@/lib/kosztorys/display-order'
import { placeCatalogueItems } from '@/lib/kosztorys/work-catalogue/place-catalogue-items'
import type {
  NewSectionCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// The name IS the sekcja's identity (owner's ruling 2026-09-22), and the picker's list is a snapshot
// taken when the dialog opened — so the match is re-run here, where nothing can have moved since.
// Case- and whitespace-insensitive, the same equality the combobox's „Dodaj „X"" row already assumes.
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
  // Both reads run on the same transaction handle, so the row cannot have gone between them. Falling
  // through to the create instead would mint a twin under a name that is already taken — the one
  // outcome this whole path exists to prevent, and it would do it silently.
  if (!owner) throw new Error(`Sekcja ${existingId} zniknęła w trakcie zapisu.`)
  const slice = await placeCatalogueItems(db, owner, catalogueItems)
  return { ...slice, createdSection: false }
}

/**
 * Create a sekcja at the TOP of the rozpiska and write cennik pozycje into it, or — when a sekcja of
 * that name already exists — append into that one instead. THE CALLER OWNS THE TRANSACTION.
 *
 * No blank first item: `createSectionWithFirstItem` mints one so a 0-row sekcja is visible at all,
 * and here the pozycje are the rows. Top placement mirrors `addSectionAction` — a sekcja appended to
 * the end of a 1000-row kosztorys has to be hunted for.
 */
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
  // sekcje, so the second caller blocks here and this re-read sees the first one's row. It costs a
  // spent shift on that branch — every sekcja one higher, with nothing at 0 — which changes no order.
  // An investment holding NO sekcje locks no rows and keeps the race; closing that needs the unique
  // index the one duplicate pair in the dump still blocks.
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
