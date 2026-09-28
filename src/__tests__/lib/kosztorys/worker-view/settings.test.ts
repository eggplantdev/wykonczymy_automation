import { describe, expect, it } from 'vitest'
import { WORKER_VIEW_GROUPS } from '@/lib/kosztorys/column-config'
import { ALL_PLANE_PRICE_KEYS, planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import {
  WORKER_VIEW_DEFAULT_SETTINGS,
  sanitizeWorkerViewSettings,
  workerColumnLabel,
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
      hiddenColumns: ['sectionName', 'price', 'plannedNet', 'discountAmount', 'price__own_tools'],
      hideEmptyRows: false,
    })

    expect(settings).toEqual({ hiddenColumns: ['sectionName'], hideEmptyRows: false })
  })

  it.each([undefined, null, 'x', 42, { hiddenColumns: 'price' }])(
    'falls back to the code default on garbage input (%s)',
    (raw) => {
      expect(sanitizeWorkerViewSettings(raw).hiddenColumns).toEqual(
        WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns,
      )
    },
  )

  it('defaults to every allowed column visible, with empty pozycje hidden', () => {
    expect(WORKER_VIEW_DEFAULT_SETTINGS).toEqual({ hiddenColumns: [], hideEmptyRows: true })
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

  it('names every group key, so the settings dialog never shows a raw id', () => {
    for (const group of WORKER_VIEW_GROUPS) {
      for (const key of group.keys) expect(workerColumnLabel(key), key).toBeTypeOf('string')
    }
  })
})
