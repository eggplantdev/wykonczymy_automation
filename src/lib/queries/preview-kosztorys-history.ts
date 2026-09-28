import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS } from '@/lib/cache/tags'
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
import { PREVIEW_KOSZTORYS_TAGS, resolveShareInvestmentId } from '@/lib/queries/preview-kosztorys'

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
  const present = candidates.filter(({ id }) => snapshots.has(id))
  return buildHistoryEntries(
    present,
    ({ id }) => {
      const snapshot = snapshots.get(id)
      if (!snapshot) throw new Error(`Snapshot ${id} vanished mid-read`)
      return snapshotToTree(snapshot.payload, live)
    },
    liveVersion(live),
  )
}

// Every entry diffs up to ~1000 rows against the live tree, so the list is computed once and kept
// until a write. `today` is in the key because midnight changes the list without any write:
// yesterday's `auto` rows stop being „today's". The live tree is both the baseline and what fills a
// stored row's gaps (settlement mode, older settings keys), hence the preview's tags beside the
// snapshot one.
const cachedHistoryList = unstable_cache(buildHistoryList, ['preview-kosztorys-history-v1'], {
  tags: [...PREVIEW_KOSZTORYS_TAGS, CACHE_TAGS.kosztorysSnapshots],
})

// Not cached: it diffs against the live tree, which the caller already holds from the preview read.
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
    ...past,
    id: snapshot.id,
    kind: snapshot.kind,
    label: snapshot.label,
    day: toWarsawDay(snapshot.takenAt),
    diff: diffVersions(past, liveVersion(current)),
  }
}

async function readInvestorHistory(
  investmentId: number,
  current: KosztorysTreeT,
  versionId: number | undefined,
): Promise<InvestorHistoryT> {
  const [entries, version] = await Promise.all([
    cachedHistoryList(investmentId, warsawToday()),
    versionId === undefined ? null : readPastVersion(investmentId, versionId, current),
  ])
  return { entries, version }
}

/**
 * The investor's change history behind a share link. `current` is the tree the page already read
 * through `getPreviewKosztorysByToken` — the version is diffed against exactly what the page shows.
 * `version` is null for any id that isn't one of this investment's visible versions: another
 * investment's, a `manual` row, or none at all read the same, and the page renders the present.
 */
export async function getPreviewHistoryByToken(
  token: string,
  current: KosztorysTreeT,
  versionId?: number,
): Promise<InvestorHistoryT | null> {
  const investmentId = await resolveShareInvestmentId(token)
  return investmentId === null ? null : readInvestorHistory(investmentId, current, versionId)
}

// The owner's „Podgląd dla inwestora" twin — the same history a share link would serve.
export async function getPreviewHistoryById(
  investmentId: number,
  current: KosztorysTreeT,
  versionId?: number,
): Promise<InvestorHistoryT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return readInvestorHistory(investmentId, current, versionId)
}
