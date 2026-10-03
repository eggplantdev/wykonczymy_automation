import { describe, expect, it } from 'vitest'

import {
  acceptedQtyNote,
  buildAccept,
  catalogueSwap,
  initialDrafts,
  lineGroup,
  previewQtyChange,
  qtyChange,
  type LineDraftT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { ReportLineT, WorkerReportT } from '@/lib/kosztorys/worker-report/types'

const draft: LineDraftT = {
  isTicked: true,
  qty: '12',
  itemId: undefined,
  isExtra: false,
  sectionId: '',
  unitPrice: '',
  catalogueId: undefined,
  matchedItemIds: [],
}

const entry = (description: string, unit: string) => ({
  id: 7,
  clientPrice: 45,
  matchKey: catalogueKey(description, unit),
})

const rows = [
  { id: 1, description: 'Gładź gipsowa', unit: 'm2' },
  { id: 2, description: 'Malowanie ścian', unit: 'm2' },
  { id: 3, description: 'Malowanie  ścian', unit: 'm²' },
]

describe('podmiana pracy spoza rozpiski na pracę z katalogu', () => {
  it('praca już w rozpisce przechodzi do „Z rozpiski” na tę pozycję, z ilością pracownika', () => {
    const swapped = { ...draft, ...catalogueSwap(entry('Gładź gipsowa', 'm2'), rows) }

    expect(lineGroup({ kind: 'extra' }, swapped)).toBe('rozpiska')
    expect(swapped.itemId).toBe(1)
    expect(swapped.qty).toBe('12')
  })

  it('praca w kilku sekcjach czeka na wybór pozycji', () => {
    const swapped = { ...draft, ...catalogueSwap(entry('Malowanie ścian', 'm2'), rows) }

    expect(lineGroup({ kind: 'extra' }, swapped)).toBe('rozpiska')
    expect(swapped.matchedItemIds).toEqual([2, 3])
    expect(swapped.itemId).toBeUndefined()
  })

  it('praca spoza rozpiski zostaje nową pozycją z ceną z katalogu', () => {
    const swapped = { ...draft, ...catalogueSwap(entry('Montaż domofonu', 'szt'), rows) }

    expect(lineGroup({ kind: 'extra' }, swapped)).toBe('extra')
    expect(swapped.catalogueId).toBe(7)
    expect(swapped.unitPrice).toBe('45')
  })
})

const line = (patch: Partial<ReportLineT>): ReportLineT => ({
  id: 1,
  kind: 'rozpiska',
  itemId: 10,
  description: 'Malowanie ścian',
  unit: 'm2',
  sectionName: 'Salon',
  reportedQty: 8,
  acceptedQty: undefined,
  createdItemId: undefined,
  catalogueItemId: undefined,
  ...patch,
})

const liveRows = [
  { id: 10, sectionId: 5 },
  { id: 11, sectionId: 5 },
] as KosztorysV2RowT[]

const report = (lines: ReportLineT[], stageId?: number) =>
  ({
    id: 7,
    investmentId: 1,
    lines,
    target: stageId === undefined ? undefined : { stageId, ordinal: 1, label: undefined },
  }) as WorkerReportT

describe('decyzja w zgłoszeniu', () => {
  it('przyjęta ilość z czterema miejscami po przecinku otwiera się bez zmiany', () => {
    const accepted = line({ acceptedQty: 1.2345 })
    const drafts = initialDrafts(report([accepted], 20), liveRows)

    expect(drafts[1].qty).toBe('1,2345')
    expect(qtyChange(accepted, drafts[1])).toBe(0)
  })

  it('odznaczona przyjęta praca mówi, co cofa — albo że nie ma już czego', () => {
    const accepted = line({ acceptedQty: 6 })
    const unticked = { ...draft, isTicked: false }

    expect(acceptedQtyNote(accepted, { ...draft, qty: '6' }, true)).toBeUndefined()
    expect(acceptedQtyNote(accepted, { ...draft, qty: '4' }, true)).toBe('było 6')
    expect(acceptedQtyNote(accepted, unticked, true)).toBe('cofasz 6')
    expect(acceptedQtyNote(accepted, unticked, false)).toBe('nie ma już czego cofnąć')
  })

  it('odznaczona przyjęta praca z usuniętego etapu nie rusza podglądu etapu ani pomiaru', () => {
    const accepted = line({ acceptedQty: 1.5 })
    const unticked = { ...draft, isTicked: false }

    expect(previewQtyChange(accepted, unticked, true)).toBe(-1.5)
    expect(previewQtyChange(accepted, unticked, false)).toBe(0)
    expect(previewQtyChange(line({}), { ...draft, qty: '2' }, false)).toBe(2)
  })

  it('zmiana i odznaczenie idą do etapu zgłoszenia, nowa praca do wybranego', () => {
    const changed = line({ id: 1, itemId: 10, acceptedQty: 7 })
    const undone = line({ id: 2, itemId: 11, acceptedQty: 3 })
    const fresh = line({ id: 3, itemId: 11, reportedQty: 2 })
    const drafts = {
      1: { ...draft, qty: '4' },
      2: { ...draft, isTicked: false },
      3: { ...draft, qty: '2' },
    }

    const { input, cells } = buildAccept(
      report([changed, undone, fresh], 20),
      drafts,
      { kind: 'stage', stageId: 20 },
      (reported) => reported.itemId,
    )

    expect(input.lines).toEqual([
      { lineId: 1, acceptedQty: 4, seenQty: 7 },
      { lineId: 3, acceptedQty: 2, itemId: undefined },
    ])
    expect(input.undone).toEqual([2])
    expect(cells).toEqual([
      { itemId: 10, stageId: 20 },
      { itemId: 11, stageId: 20 },
      { itemId: 11, stageId: 20 },
    ])
  })
})
