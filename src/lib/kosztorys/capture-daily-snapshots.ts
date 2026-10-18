import 'server-only'
import { isDeepStrictEqual } from 'node:util'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot, latestSnapshot, listDailyEligibleInvestmentIds } from '@/lib/db/snapshots'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { snapshotToTree } from '@/lib/kosztorys/history/snapshot-to-tree'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import type {
  KosztorysSnapshotPayloadT,
  StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { endOfPreviousWarsawDay } from '@/lib/utils/days'

type DailyCaptureResultT = { stored: number; unchanged: number; failed: number }

// jsonb's shape: without it an `undefined` key reads as a change every night.
const asJsonb = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Rendered as the history reads them, or a key a deploy added stores a full copy of every open investment.
export function sameDailyState(
  previous: StoredSnapshotPayloadT,
  current: KosztorysSnapshotPayloadT,
  live: KosztorysTreeT,
): boolean {
  const render = (payload: StoredSnapshotPayloadT) => asJsonb(snapshotToTree(payload, live).tree)
  return isDeepStrictEqual(render(previous), render(asJsonb(current)))
}

export async function captureDailySnapshot(
  db: DbExecutorT,
  investmentId: number,
  takenAt: Date,
): Promise<'stored' | 'unchanged'> {
  const previous = await latestSnapshot(db, investmentId, 'daily')
  if (previous && previous.takenAt.getTime() >= takenAt.getTime()) return 'unchanged'

  const live = await buildKosztorysTree(investmentId)
  const payload = serializeTree(live)
  if (previous && sameDailyState(previous.payload, payload, live)) return 'unchanged'

  await insertSnapshot(db, {
    investmentId,
    kind: 'daily',
    label: null,
    takenBy: null,
    payload,
    takenAt,
  })
  return 'stored'
}

// Sequential, never Promise.all: 65 trees built in parallel would hold 65 connections of a pool that
// serves live requests too.
export async function captureDailySnapshots(
  db: DbExecutorT,
  now: Date,
): Promise<DailyCaptureResultT> {
  const takenAt = endOfPreviousWarsawDay(now)
  const result: DailyCaptureResultT = { stored: 0, unchanged: 0, failed: 0 }

  for (const investmentId of await listDailyEligibleInvestmentIds(db)) {
    try {
      result[await captureDailySnapshot(db, investmentId, takenAt)]++
    } catch (err) {
      // TODO(EX-958) SENTRY-REQUIRED: a tree that fails every night silently loses the investor's history.
      console.error(`[daily-snapshots] investment ${investmentId} failed`, err)
      result.failed++
    }
  }
  return result
}
