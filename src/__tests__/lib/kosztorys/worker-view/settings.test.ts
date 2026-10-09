import { describe, expect, it } from 'vitest'
import { WORKER_VIEW_GROUPS, workerColumnLabel } from '@/lib/kosztorys/worker-view/columns'
import { ALL_PLANE_PRICE_KEYS, planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import {
  WORKER_VIEW_DEFAULT_SETTINGS,
  sanitizeWorkerViewSettings,
  workerDocumentColumns,
  workerVisibleColumns,
} from '@/lib/kosztorys/worker-view/settings'

// The main risk of the change: a worker's screen showing the client price — which gives the margin
// away. Settings may only SUBTRACT from the worker ceiling; nothing typed into them may add to it.

const CLIENT_PRICED = [
  'price',
  'priceGross',
  'plannedNet',
  'plannedGross',
  'remaining',
  'remainingGross',
  'donePercent',
  'discountType',
  'discountValue',
  'discountAmount',
  'discountAmountGross',
  'gross',
  'note',
]

describe('worker view settings', () => {
  it('drops a hand-added client-price or other-plane key', () => {
    const settings = sanitizeWorkerViewSettings({
      hiddenColumns: ['unit', 'price', 'plannedNet', 'discountAmount', 'price__own_tools'],
      hideEmptyRows: false,
    })

    expect(settings).toEqual({
      hiddenColumns: ['unit'],
      hideEmptyRows: false,
      hidePlannedOnceExecuted: true,
      columnRanks: {},
    })
  })

  // A quantity and a percentage of quantities disclose no price, so the offer is the managers' call
  // (2026-10-09).
  it('offers the Przedmiar ofertowy and the percentage against it, unticked by default', () => {
    const keys = WORKER_VIEW_GROUPS.flatMap((group) => group.keys)

    for (const key of ['plannedQty', 'currentPlannedQty', 'plannedDonePercent']) {
      expect(keys, key).toContain(key)
    }
    const columns = workerVisibleColumns('w_tools', WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns)
    expect(columns.has('plannedQty')).toBe(false)
    expect(columns.has('plannedDonePercent')).toBe(false)
    expect(columns.has('currentPlannedQty')).toBe(true)
  })

  it('reads a stored `plannedQty` untick and position as the Przedmiar ofertowy', () => {
    const settings = sanitizeWorkerViewSettings({
      hiddenColumns: ['plannedQty', 'unit'],
      columnRanks: { plannedQty: 3 },
    })

    expect(settings.hiddenColumns).toEqual(['plannedQty', 'unit'])
    expect(settings.columnRanks).toEqual({ plannedQty: 3 })
  })

  it.each([undefined, null, 'x', 42, { hiddenColumns: 'price' }])(
    'falls back to the code default on garbage input (%s)',
    (raw) => {
      expect(sanitizeWorkerViewSettings(raw).hiddenColumns).toEqual(
        WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns,
      )
    },
  )

  it('defaults to every allowed column but the offer visible, with empty pozycje hidden', () => {
    expect(WORKER_VIEW_DEFAULT_SETTINGS).toEqual({
      hiddenColumns: ['plannedQty', 'plannedDonePercent'],
      hideEmptyRows: true,
      hidePlannedOnceExecuted: true,
      columnRanks: {},
    })
  })

  it('keeps a stored „hide przedmiar once work exists" off, and reads anything else as on', () => {
    expect(
      sanitizeWorkerViewSettings({ hidePlannedOnceExecuted: false }).hidePlannedOnceExecuted,
    ).toBe(false)
    for (const raw of [undefined, null, 'false', 0, true]) {
      expect(
        sanitizeWorkerViewSettings({ hidePlannedOnceExecuted: raw }).hidePlannedOnceExecuted,
        String(raw),
      ).toBe(true)
    }
    expect(sanitizeWorkerViewSettings(null).hidePlannedOnceExecuted).toBe(true)
  })

  it("resolves the stawka to the worker's plane and never to the client price or the other plane", () => {
    const columns = workerVisibleColumns('w_tools', [])

    expect(columns.has(planePriceKey('price', 'w_tools'))).toBe(true)
    for (const key of ALL_PLANE_PRICE_KEYS) {
      if (key === planePriceKey('price', 'w_tools')) continue
      expect(columns.has(key), key).toBe(false)
    }
    for (const key of CLIENT_PRICED) expect(columns.has(key), key).toBe(false)
  })

  it('no key in any group is itself a client-priced column', () => {
    const grouped = WORKER_VIEW_GROUPS.flatMap((group) => group.keys)
    for (const key of CLIENT_PRICED) expect(grouped, key).not.toContain(key)
  })

  it('subtracts the hidden keys, the stawka included', () => {
    const columns = workerVisibleColumns('own_tools', ['rate', STAGES_COLUMN_GROUP])

    expect(columns.has(planePriceKey('price', 'own_tools'))).toBe(false)
    expect(columns.has(STAGES_COLUMN_GROUP)).toBe(false)
    expect(columns.has('description')).toBe(true)
  })

  it('keeps a stored order only for keys inside the worker ceiling, never for „Opis prac"', () => {
    const settings = sanitizeWorkerViewSettings({
      hiddenColumns: ['description', 'unit'],
      columnRanks: { rate: -1, price: -2, description: 99, net: Number.NaN, unit: 'x' },
    })

    expect(settings.hiddenColumns).toEqual(['unit'])
    expect(settings.columnRanks).toEqual({ rate: -1 })
  })

  it.each(['w_tools', 'own_tools'] as const)(
    'orders the stawka by its logical rank on the %s plane',
    (plane) => {
      const columns = workerDocumentColumns(plane, { rate: -1 })

      expect(columns.slice(0, 2)).toEqual(['description', planePriceKey('price', plane)])
    },
  )

  it('names every group key, so the settings dialog never shows a raw id', () => {
    for (const group of WORKER_VIEW_GROUPS) {
      for (const key of group.keys) expect(workerColumnLabel(key), key).toBeTypeOf('string')
    }
  })
})
