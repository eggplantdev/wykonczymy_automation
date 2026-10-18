import type { Payload } from 'payload'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const ctx = { context: { skipRevalidation: true } }

// A szablon keeps only katalog-linked prace. Found before created because `matchKey` is unique
// across a katalog no run resets, so the second run would collide with the first one's entry.
export async function seedCatalogueEntry(payload: Payload, description: string): Promise<number> {
  const matchKey = catalogueKey(description, 'm2')
  const { docs } = await payload.find({
    collection: 'work-catalogue-items',
    where: { matchKey: { equals: matchKey } },
    limit: 1,
    depth: 0,
  })
  if (docs[0]) return docs[0].id
  const entry = await payload.create({
    collection: 'work-catalogue-items',
    data: { description, unit: 'm2', clientPrice: 100, matchKey },
    ...ctx,
  })
  return entry.id
}
