import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  deleteExpiredInvestorSnapshots,
  deleteSnapshotsPastCeiling,
  thinDailyBand,
  thinWeeklyBand,
  type RetentionScopeT,
} from '@/lib/db/snapshots'

async function gcRetentionBands(db: DbExecutorT, scope: RetentionScopeT) {
  const ceiling = await deleteSnapshotsPastCeiling(db, scope)
  const daily = await thinDailyBand(db, scope)
  const weekly = await thinWeeklyBand(db, scope)
  return { ceiling, daily, weekly }
}

export async function gcSnapshots(db: DbExecutorT): Promise<{
  deleted: number
  ceiling: number
  daily: number
  weekly: number
  investorExpired: number
}> {
  const bands = await gcRetentionBands(db, 'kosztorys')
  const investorExpired = await deleteExpiredInvestorSnapshots(db)
  const counts = { ...bands, investorExpired }
  return {
    deleted: counts.ceiling + counts.daily + counts.weekly + counts.investorExpired,
    ...counts,
  }
}

export async function gcTemplateSnapshots(
  db: DbExecutorT,
): Promise<{ deleted: number; ceiling: number; daily: number; weekly: number }> {
  const counts = await gcRetentionBands(db, 'template')
  return { deleted: counts.ceiling + counts.daily + counts.weekly, ...counts }
}
