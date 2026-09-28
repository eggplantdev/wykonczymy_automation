import 'server-only'
import { isDeepStrictEqual } from 'node:util'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot, latestSnapshot, listDailyEligibleInvestmentIds } from '@/lib/db/snapshots'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { endOfPreviousWarsawDay } from '@/lib/utils/days'

type DailyCaptureResultT = { stored: number; unchanged: number; failed: number }

/**
 * One `daily` row per investment per Warsaw day, and only for a day whose end state differs from the
 * previous `daily` — an unchanged day leaves no row, which the history reader relies on.
 */
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
// serves live requests too. Each investment fails alone, so one broken tree costs one day of one
// investment's history, not the night's run.
export async function captureDailySnapshots(
  db: DbExecutorT,
  now: Date,
): Promise<DailyCaptureResultT> {
  // The run always happens after Warsaw midnight (see the cron route), so the day it describes is the
  // one that just ended, and its version is stamped at that day's last instant.
  const takenAt = endOfPreviousWarsawDay(now)
  const result: DailyCaptureResultT = { stored: 0, unchanged: 0, failed: 0 }

  for (const investmentId of await listDailyEligibleInvestmentIds(db)) {
    try {
      result[await captureDailySnapshot(db, investmentId, takenAt)]++
    } catch (err) {
      // TODO(EX-449) SENTRY-REQUIRED: a tree that fails every night silently loses the investor's history.
      console.error(`[daily-snapshots] investment ${investmentId} failed`, err)
      result.failed++
    }
  }
  return result
}
