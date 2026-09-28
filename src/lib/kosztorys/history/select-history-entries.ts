import { toWarsawDay, type DayT } from '@/lib/utils/days'
import { diffVersions, hasChanges } from './diff-versions'
import { summarizeChange } from './summarize-change'
import type { HistoryEntryT, HistoryMetaT, HistoryVersionT } from './types'

export const FIRST_VERSION_SUMMARY = 'Pierwsza zapisana wersja'
export const NO_CHANGE_SUMMARY = 'Bez zmian'

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
 * The list the investor reads, newest first. Each entry is summarised against the entry listed before
 * it, and a day that changed nothing the investor can see is not listed — a named version always is,
 * because the owner named it.
 */
export function buildHistoryEntries(
  candidates: readonly HistoryMetaT[],
  versionOf: (meta: HistoryMetaT) => HistoryVersionT,
): HistoryEntryT[] {
  const entries: HistoryEntryT[] = []
  let previous: HistoryVersionT | undefined
  for (const meta of candidates) {
    const version = versionOf(meta)
    const diff = previous ? diffVersions(previous, version) : undefined
    if (diff && !hasChanges(diff) && meta.kind !== 'named') continue

    entries.push({
      id: meta.id,
      kind: meta.kind,
      label: meta.label,
      day: toWarsawDay(meta.takenAt),
      summary: !diff
        ? FIRST_VERSION_SUMMARY
        : hasChanges(diff)
          ? summarizeChange(diff)
          : NO_CHANGE_SUMMARY,
    })
    previous = version
  }
  return entries.reverse()
}
