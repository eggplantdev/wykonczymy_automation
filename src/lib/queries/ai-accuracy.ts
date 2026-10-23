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
import {
  scoreCases,
  summarizeAccuracy,
  type AiAccuracyItemT,
  type AiAccuracyT,
} from '@/lib/kosztorys/ai-accuracy'
import { perfStart } from '@/lib/perf'

export const fetchAiAccuracy = cached(
  async (): Promise<AiAccuracyT | undefined> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const rows = await selectAiAccuracyItems(
      await getDb(payload),
      AI_ACCURACY_REVIEWED_STAGES,
      AI_ACCURACY_EXCLUDED_INVESTMENT_IDS,
    )
    const cases = new Map<
      number,
      { investmentId: number; label: string; items: AiAccuracyItemT[] }
    >()
    for (const { investmentId, investmentName, ...item } of rows) {
      const existing = cases.get(investmentId)
      if (existing) existing.items.push(item)
      else cases.set(investmentId, { investmentId, label: investmentName, items: [item] })
    }
    const accuracy = cases.size ? summarizeAccuracy(scoreCases([...cases.values()])) : undefined
    console.log(`[PERF] query.fetchAiAccuracy ${elapsed()}ms (${cases.size} investments)`)
    return accuracy
  },
  ['ai-accuracy'],
  { tags: [CACHE_TAGS.kosztorysItems, CACHE_TAGS.investments] },
)
