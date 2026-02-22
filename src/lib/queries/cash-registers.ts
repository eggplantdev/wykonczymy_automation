import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export async function getCashRegister(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters, entityTag('cash-register', id))

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  try {
    const register = await payload.findByID({
      collection: 'cash-registers',
      id,
      depth: 1,
      overrideAccess: true,
    })
    console.log(`[PERF] query.getCashRegister(${id}) ${elapsed()}ms`)
    return register ?? null
  } catch {
    return null
  }
}
