import 'server-only'
import { isDeepStrictEqual } from 'node:util'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot, latestSnapshot, listDailyEligibleInvestmentIds } from '@/lib/db/snapshots'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { endOfPreviousWarsawDay } from '@/lib/utils/days'

type DailyCaptureResultT = { stored: number; unchanged: number; failed: number }

export async function captureDailySnapshot(
  db: DbExecutorT,
  investmentId: number,
  takenAt: Date,
): Promise<'stored' | 'unchanged'> {
  const previous = await latestSnapshot(db, investmentId, 'daily')
  if (previous && previous.takenAt.getTime() >= takenAt.getTime()) return 'unchanged'

  const payload = serializeTree(await buildKosztorysTree(investmentId))
  // Through JSON so both sides have jsonb's shape (no `undefined` keys); compared as objects, because
  // jsonb does not keep key order and a string comparison would see every night as a change.
  if (previous && isDeepStrictEqual(JSON.parse(JSON.stringify(payload)), previous.payload)) {
    return 'unchanged'
  }

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
