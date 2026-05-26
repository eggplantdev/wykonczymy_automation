import { unstable_cache, cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export async function getInvestment(id: string) {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.investments, entityTag('investment', id))

  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      try {
        const investment = await payload.findByID({
          collection: 'investments',
          id,
          overrideAccess: true,
        })
        console.log(`[PERF] query.getInvestment(${id}) ${elapsed()}ms`)
        return investment ?? null
      } catch {
        return null
      }
    },
    ['investment', id],
    { tags: [CACHE_TAGS.investments, entityTag('investment', id)] },
  )()
}
