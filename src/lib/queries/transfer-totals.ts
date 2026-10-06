import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { CACHE_TAGS } from '@/lib/cache/tags'
import {
  listTransferFacets,
  sumFilteredByType,
  sumCategoryByTypeSettled,
} from '@/lib/db/sum-transfers'
import { deriveCategoryBreakdowns } from '@/lib/db/investment-financials'
import type { TransferFacetsT } from '@/lib/db/sum-transfers'
import type { TypeSettledTotalT, CategoryBreakdownsT } from '@/types/investment-financials'

export async function fetchFilteredByType(where: Where): Promise<TypeSettledTotalT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return sumFilteredByType(payload, where)
    },
    ['filtered-by-type', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

export async function fetchCategoryBreakdowns(where: Where): Promise<CategoryBreakdownsT> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return deriveCategoryBreakdowns(await sumCategoryByTypeSettled(payload, where))
    },
    ['category-breakdowns-v2', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

export async function fetchTransferFacets(where: Where): Promise<TransferFacetsT> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return listTransferFacets(payload, where)
    },
    ['transfer-facets', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}
