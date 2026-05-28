import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

// Row shape served to the listing page. `investment` is undefined for an
// unlinked kosztorys (registered before the project is committed).
export type KosztorysRowT = {
  id: number
  name: string
  googleSheetId: string
  investment?: {
    id: number
    name: string
  }
  updatedAt: string
}

// All kosztoryses + their linked investment (depth: 1). Sorted newest first
// so freshly-added unlinked rows surface to the top.
export const fetchAllKosztoryses = unstable_cache(
  async (): Promise<KosztorysRowT[]> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'kosztoryses',
      depth: 1,
      limit: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    })
    console.log(`[PERF] query.fetchAllKosztoryses ${elapsed()}ms (${result.docs.length} rows)`)

    return result.docs.map((doc) => {
      const investmentRel = doc.investment
      const investment =
        investmentRel && typeof investmentRel === 'object'
          ? { id: investmentRel.id as number, name: investmentRel.name as string }
          : undefined
      return {
        id: doc.id as number,
        name: doc.name,
        googleSheetId: doc.googleSheetId,
        investment,
        updatedAt: doc.updatedAt,
      }
    })
  },
  ['all-kosztoryses'],
  { tags: [CACHE_TAGS.kosztoryses] },
)
