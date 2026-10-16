import 'server-only'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS, KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { getHistorySnapshots, listHistoryMetas } from '@/lib/db/snapshots'
import { diffVersions } from '@/lib/kosztorys/history/diff-versions'
import {
  buildHistoryEntries,
  selectHistoryCandidates,
} from '@/lib/kosztorys/history/select-history-entries'
import { liveVersion, snapshotToTree } from '@/lib/kosztorys/history/snapshot-to-tree'
import type { HistoryEntryT, InvestorHistoryT, PastVersionT } from '@/lib/kosztorys/history/types'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { toWarsawDay, warsawToday, type DayT } from '@/lib/utils/days'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { resolveShareInvestmentId } from '@/lib/queries/preview-kosztorys'

// Unexported, like the preview builder: both are authorization-free, and the entrances below are the
// only ways in.
async function buildHistoryList(investmentId: number, today: DayT): Promise<HistoryEntryT[]> {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [metas, live] = await Promise.all([
    listHistoryMetas(db, investmentId),
    buildKosztorysTree(investmentId),
  ])
  const candidates = selectHistoryCandidates(metas, today)
  const snapshots = await getHistorySnapshots(
    db,
    investmentId,
    candidates.map(({ id }) => id),
  )
  // The retention sweep may delete a row between the two queries.
  const present = candidates.flatMap((meta) => {
    const snapshot = snapshots.get(meta.id)
    return snapshot ? [{ meta, version: snapshotToTree(snapshot.payload, live) }] : []
  })
  return buildHistoryEntries(present, liveVersion(live))
}

// `today` is in the key because midnight changes the list without any write: yesterday's `auto`
// rows stop being „today's".
const cachedHistoryList = cached(buildHistoryList, ['preview-kosztorys-history'], {
  tags: [...KOSZTORYS_TREE_TAGS.map((tag) => CACHE_TAGS[tag]), CACHE_TAGS.kosztorysSnapshots],
})

async function readPastVersion(
  investmentId: number,
  versionId: number,
  current: KosztorysTreeT,
): Promise<PastVersionT | null> {
  const payload = await getPayload({ config })
  const snapshot = (await getHistorySnapshots(await getDb(payload), investmentId, [versionId])).get(
    versionId,
  )
  if (!snapshot) return null

  const past = snapshotToTree(snapshot.payload, current)
  return {
    tree: past.tree,
    id: snapshot.id,
    label: snapshot.label,
    day: toWarsawDay(snapshot.takenAt),
    diff: diffVersions(past, liveVersion(current)),
  }
}

async function readInvestorHistory(
  investmentId: number,
  current: KosztorysTreeT,
  versionId: number | undefined,
): Promise<InvestorHistoryT | null> {
  try {
    const [entries, version] = await Promise.all([
      cachedHistoryList(investmentId, warsawToday()),
      versionId === undefined ? null : readPastVersion(investmentId, versionId, current),
    ])
    return { entries, version }
  } catch (error) {
    // TODO(EX-958) SENTRY-REQUIRED: the investor silently loses the history until someone looks.
    console.error(`[investor-history] investment ${investmentId}:`, error)
    return null
  }
}

export async function getPreviewHistoryByToken(
  token: string,
  current: KosztorysTreeT,
  versionId?: number,
): Promise<InvestorHistoryT | null> {
  const investmentId = await resolveShareInvestmentId(token)
  return investmentId === null ? null : readInvestorHistory(investmentId, current, versionId)
}

export async function getPreviewHistoryById(
  investmentId: number,
  current: KosztorysTreeT,
  versionId?: number,
): Promise<InvestorHistoryT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return readInvestorHistory(investmentId, current, versionId)
}
