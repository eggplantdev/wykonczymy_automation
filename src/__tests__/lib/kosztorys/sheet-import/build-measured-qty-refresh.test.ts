import { describe, expect, it } from 'vitest'
import { buildMeasuredQtyRefresh } from '@/lib/kosztorys/sheet-import/build-measured-qty-refresh'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { col } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import { BIALOSTOCKA_ROWS } from '@/__tests__/fixtures/kosztorys-sheet/rows'

const source = (laborGrid: (string | number)[][]): ImportGridsT => ({
  laborGrid,
  laborGridFormulas: [],
  laborTabGid: 70964819,
  rateTabs: [],
})

// „Pomiar z natury" is an OPTIONAL column: a client who titled it something else still has a
// perfectly good sheet, and the resolver says so by returning ok with the field unresolved.
function withoutPomiarHeader(): (string | number)[][] {
  const measured = col('O')
  return BIALOSTOCKA_ROWS.map((sheetRow) => {
    const copy = [...sheetRow]
    if (typeof copy[measured] === 'string' && copy[measured].startsWith('Pomiar'))
      copy[measured] = 'ilość wykonana'
    return copy
  })
}

const item = (overrides: Partial<KosztorysItemT> & { id: number }): KosztorysItemT => ({
  sectionId: 1,
  displayOrder: 0,
  description: null,
  unit: null,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 0,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  ...overrides,
})

// The same prace as Białostocka, each already carrying a stored Pomiar — so anything that clears
// them shows up as rows, and nothing else can.
function currentTree(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [
      { id: 1, name: 'Prace dodatkowe', displayOrder: 0, color: 'blue' },
      { id: 2, name: 'Klimatyzacja', displayOrder: 1, color: 'green' },
    ],
    items: [
      item({
        id: 10,
        sectionId: 1,
        description: 'zakup, transport i wniesienie towaru budowlanego',
        sheetMeasuredQty: 1,
      }),
      item({
        id: 11,
        sectionId: 1,
        description: 'montaż płyt akustycznych dodatek',
        sheetMeasuredQty: 50,
      }),
      item({
        id: 12,
        sectionId: 2,
        description: 'montaż jednostki wewnętrznej',
        sheetMeasuredQty: 2,
      }),
    ],
    stages: [],
    progress: [],
    settings: { wToolsCoeff: 1, ownToolsCoeff: 1, vatRate: 8 },
  }
}

describe('buildMeasuredQtyRefresh', () => {
  it('writes nothing when the sheet has no „Pomiar z natury" column', () => {
    const refresh = buildMeasuredQtyRefresh(source(withoutPomiarHeader()), currentTree())

    expect(refresh.ok).toBe(true)
    if (!refresh.ok) return
    // The sheet said nothing about the measurement — that is not the same as saying zero, and
    // wiping every stored figure would destroy the reference „Rozjazd" is computed against.
    expect(refresh.refresh.rows).toEqual([])
  })

  it('clears a stored figure the sheet itself no longer claims', () => {
    const tree = currentTree()
    tree.items[0].sheetMeasuredQty = 999

    const refresh = buildMeasuredQtyRefresh(source(BIALOSTOCKA_ROWS), tree)

    expect(refresh.ok).toBe(true)
    if (!refresh.ok) return
    expect(refresh.refresh.rows).toEqual([{ id: 10, qty: 1 }])
  })
})
