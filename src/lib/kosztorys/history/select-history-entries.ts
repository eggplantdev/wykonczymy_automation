import { toWarsawDay, type DayT } from '@/lib/utils/days'
import { diffVersions, hasChanges } from './diff-versions'
import { countChangeRows, differenceSummary } from './change-rows'
import type { HistoryEntryT, HistoryMetaT, HistoryVersionT } from './types'

/**
 * From the first `daily` on, `auto` rows are ignored: the night run skips an unchanged day, so a day
 * with no `daily` is a day that ended where the previous one did — and its newest `auto` may be a
 * state from mid-edit that never was the end of anything.
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

export function buildHistoryEntries(
  candidates: readonly { meta: HistoryMetaT; version: HistoryVersionT }[],
  current: HistoryVersionT,
): HistoryEntryT[] {
  const entries: HistoryEntryT[] = []
  let previous: HistoryVersionT | undefined
  for (const { meta, version } of candidates) {
    if (previous && !hasChanges(diffVersions(previous, version)) && meta.kind !== 'named') continue

    entries.push({
      id: meta.id,
      label: meta.label,
      day: toWarsawDay(meta.takenAt),
      summary: differenceSummary(countChangeRows(diffVersions(version, current))),
    })
    previous = version
  }
  return entries.reverse()
}
