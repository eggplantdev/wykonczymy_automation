import { describe, it, expect } from 'vitest'
import {
  buildHistoryEntries,
  FIRST_VERSION_SUMMARY,
  NO_CHANGE_SUMMARY,
  selectHistoryCandidates,
} from '@/lib/kosztorys/history/select-history-entries'
import type { HistoryMetaT, HistoryVersionT } from '@/lib/kosztorys/history/types'
import { item, version } from '@/__tests__/helpers/kosztorys-history'

const meta = (
  id: number,
  kind: HistoryMetaT['kind'],
  takenAt: string,
  label: string | null = null,
) => ({ id, kind, label, takenAt: new Date(takenAt) }) satisfies HistoryMetaT

const ids = (metas: HistoryMetaT[]) => metas.map(({ id }) => id)
const TODAY = '2026-10-10'

describe('selectHistoryCandidates', () => {
  it('takes the newest auto of each day before the first daily, and only dailies after it', () => {
    const metas = [
      meta(1, 'auto', '2026-10-01T08:00:00Z'),
      meta(2, 'auto', '2026-10-01T15:00:00Z'),
      meta(3, 'auto', '2026-10-02T09:00:00Z'),
      meta(4, 'daily', '2026-10-03T21:59:59.999Z'),
      // An intermediate state on a day the night run found unchanged — never listed.
      meta(5, 'auto', '2026-10-04T10:00:00Z'),
      meta(6, 'auto', '2026-10-05T10:00:00Z'),
      meta(7, 'daily', '2026-10-05T21:59:59.999Z'),
    ]
    expect(ids(selectHistoryCandidates(metas, TODAY))).toEqual([2, 3, 4, 7])
  })

  it('lists every named version, beside the day it was saved on', () => {
    const metas = [
      meta(1, 'daily', '2026-10-03T21:59:59.999Z'),
      meta(2, 'named', '2026-10-03T12:00:00Z', 'Oferta podpisana'),
      meta(3, 'named', '2026-10-03T13:00:00Z', 'Po rozmowie'),
    ]
    expect(ids(selectHistoryCandidates(metas, TODAY))).toEqual([2, 3, 1])
  })

  it('skips today’s autos: the day has not ended', () => {
    const metas = [meta(1, 'auto', '2026-10-09T10:00:00Z'), meta(2, 'auto', '2026-10-10T10:00:00Z')]
    expect(ids(selectHistoryCandidates(metas, TODAY))).toEqual([1])
  })

  // 23:30 UTC is already the next day in Warsaw, in both seasons.
  it.each([
    ['winter', '2026-01-14T22:30:00Z', '2026-01-14T23:30:00Z'],
    ['summer', '2026-07-14T21:30:00Z', '2026-07-14T22:30:00Z'],
    ['autumn DST night', '2026-10-24T21:30:00Z', '2026-10-24T22:30:00Z'],
  ])('splits days at Warsaw midnight (%s)', (_, before, after) => {
    const metas = [meta(1, 'auto', before), meta(2, 'auto', after)]
    expect(ids(selectHistoryCandidates(metas, '2027-01-01'))).toEqual([1, 2])
  })
})

describe('buildHistoryEntries', () => {
  const versions = new Map<number, HistoryVersionT>([
    [1, version([item(1, 'Płytki', 10, 100)])],
    [2, version([item(1, 'Płytki', 12, 100)])],
    [3, version([item(1, 'Płytki', 12, 100)])],
    [4, version([item(1, 'Płytki', 12, 100)])],
  ])
  const versionOf = ({ id }: HistoryMetaT) => versions.get(id)!

  it('lists newest first, drops a day equal to the one before, and keeps a named one regardless', () => {
    const entries = buildHistoryEntries(
      [
        meta(1, 'daily', '2026-10-01T21:59:59.999Z'),
        meta(2, 'daily', '2026-10-02T21:59:59.999Z'),
        meta(3, 'daily', '2026-10-03T21:59:59.999Z'),
        meta(4, 'named', '2026-10-04T09:00:00Z', 'Oferta podpisana'),
      ],
      versionOf,
    )

    expect(entries).toEqual([
      {
        id: 4,
        kind: 'named',
        label: 'Oferta podpisana',
        day: '2026-10-04',
        summary: NO_CHANGE_SUMMARY,
      },
      {
        id: 2,
        kind: 'daily',
        label: null,
        day: '2026-10-02',
        summary: 'Przedmiar zmieniony w 1 pracy',
      },
      { id: 1, kind: 'daily', label: null, day: '2026-10-01', summary: FIRST_VERSION_SUMMARY },
    ])
  })

  it('an empty history is an empty list', () => {
    expect(buildHistoryEntries([], versionOf)).toEqual([])
  })
})
