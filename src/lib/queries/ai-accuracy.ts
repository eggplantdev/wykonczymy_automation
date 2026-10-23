import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cached } from '@/lib/cache/cached'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { selectAiAccuracyItems } from '@/lib/db/ai-accuracy-items'
import {
  AI_ACCURACY_EXCLUDED_INVESTMENT_IDS,
  AI_ACCURACY_REVIEWED_STAGES,
} from '@/lib/constants/investment-ai-stage'
import { scoreCases, summarizeAccuracy, type AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { perfStart } from '@/lib/perf'
import { groupInOrder } from '@/lib/utils/group-in-order'

export const fetchAiAccuracy = cached(
  async (): Promise<AiAccuracyT | undefined> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const rows = await selectAiAccuracyItems(
      await getDb(payload),
      AI_ACCURACY_REVIEWED_STAGES,
      AI_ACCURACY_EXCLUDED_INVESTMENT_IDS,
    )
    const cases = [...groupInOrder(rows, (row) => row.investmentId).values()].map((group) => ({
      investmentId: group[0].investmentId,
      label: group[0].investmentName,
      items: group,
    }))
    const accuracy = cases.length ? summarizeAccuracy(scoreCases(cases)) : undefined
    console.log(`[PERF] query.fetchAiAccuracy ${elapsed()}ms (${cases.length} investments)`)
    return accuracy
  },
  ['ai-accuracy'],
  { tags: [CACHE_TAGS.kosztorysItems, CACHE_TAGS.investments] },
)
