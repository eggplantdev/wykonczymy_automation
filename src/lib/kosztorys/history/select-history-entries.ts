import { toWarsawDay, type DayT } from '@/lib/utils/days'
import { diffVersions, hasChanges } from './diff-versions'
import { differenceSummary, versionChangeRows } from './change-rows'
import type { HistoryEntryT, HistoryMetaT, HistoryVersionT } from './types'

/**
 * One version per Warsaw day plus every named one, oldest first. A day's version is its `daily` row;
 * before the investment's first `daily` there are none, and the newest `auto` of the day stands in.
 *
 * From the first `daily` on, `auto` rows are ignored: the night run skips an unchanged day, so a day
 * with no `daily` is a day that ended where the previous one did — and its newest `auto` may be a
 * state from mid-edit that never was the end of anything. Today's `auto` is skipped for the same
 * reason: the day has not ended.
 */
export function selectHistoryCandidates(
  metas: readonly HistoryMetaT[],
  today: DayT,
): HistoryMetaT[] {
  const dailyDays = metas
    .filter((meta) => meta.kind === 'daily')
    .map((meta) => toWarsawDay(meta.takenAt))
  const firstDailyDay =
    dailyDays.length > 0 ? dailyDays.reduce((a, b) => (a < b ? a : b)) : undefined

  const byDay = new Map<DayT, HistoryMetaT>()
  const named: HistoryMetaT[] = []
  for (const meta of metas) {
    if (meta.kind === 'named') {
      named.push(meta)
      continue
    }
    const day = toWarsawDay(meta.takenAt)
    if (
      meta.kind === 'auto' &&
      (day >= today || (firstDailyDay !== undefined && day >= firstDailyDay))
    ) {
      continue
    }
    const kept = byDay.get(day)
    if (!kept || kept.takenAt < meta.takenAt) byDay.set(day, meta)
  }

  return [...byDay.values(), ...named].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
}

/**
 * The list the investor reads, newest first. Every entry counts its differences from `current` —
 * the same comparison the version view opens on, so the list never promises a change the view then
 * denies. A day identical to the entry listed before it is left out; a named version always stays,
 * because the owner named it.
 */
export function buildHistoryEntries(
  candidates: readonly HistoryMetaT[],
  versionOf: (meta: HistoryMetaT) => HistoryVersionT,
  current: HistoryVersionT,
): HistoryEntryT[] {
  const entries: HistoryEntryT[] = []
  let previous: HistoryVersionT | undefined
  for (const meta of candidates) {
    const version = versionOf(meta)
    if (previous && !hasChanges(diffVersions(previous, version)) && meta.kind !== 'named') continue

    entries.push({
      id: meta.id,
      kind: meta.kind,
      label: meta.label,
      day: toWarsawDay(meta.takenAt),
      summary: differenceSummary(versionChangeRows(diffVersions(version, current)).length),
    })
    previous = version
  }
  return entries.reverse()
}
