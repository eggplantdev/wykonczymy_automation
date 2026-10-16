import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/columns/column-config'
import { layerAllows } from '@/lib/kosztorys/layer'
import { axisAllows } from '@/lib/kosztorys/money-axis'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [makeStage({ id: 7, label: 'Etap 1', plane: null })]

const PLANES: ToolPlaneT[] = ['w_tools', 'own_tools']
const VIEWS = ['client', 'w_tools', 'own_tools'] as const

const PRICE_IDS = PLANES.map((plane) => planePriceKey('price', plane))
const MODE_IDS = PLANES.map((plane) => planePriceKey('priceMode', plane))
const COEFF_IDS = PLANES.map((plane) => planePriceKey('priceCoeff', plane))

function ids(opts: Partial<BuildV2ColumnsOptsT> & Pick<BuildV2ColumnsOptsT, 'view'>): string[] {
  return buildV2Columns({ stages: STAGES, crewAxis: 'both', ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('subcontractor rate columns, both planes', () => {
  it('assembles both planes’ rate in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(PRICE_IDS))
    }
  })

  it('assembles the source column in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(MODE_IDS))
    }
  })

  it('assembles the mnożnik column in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(COEFF_IDS))
    }
  })

  // the bare `price` is what each investment's client-view
  // settings already store, so a plane suffix here would orphan every saved choice.
  it("keeps the client's own price column distinct, and present in every view", () => {
    expect(PRICE_IDS).not.toContain('price')
    for (const view of VIEWS) {
      expect(ids({ view })).toContain('price')
    }
  })

  it('offers each rate column as its own picker entry, named by plane', () => {
    const { columnToggleItems } = buildV2Grid({ view: 'w_tools', stages: STAGES, crewAxis: 'both' })
    const planeIds = [...MODE_IDS, ...COEFF_IDS, ...PRICE_IDS]
    const entries = columnToggleItems.filter((item) => planeIds.includes(item.id))

    expect(entries).toHaveLength(planeIds.length)
    expect(new Set(entries.map((item) => item.id)).size).toBe(planeIds.length)
    expect(entries.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Cena j.m. netto — z narzędziami (podwykonawca)',
        'Cena j.m. netto — bez narzędzi (pracownik)',
        'Źródło ceny wykonawcy — z narzędziami (podwykonawca)',
        'Źródło ceny wykonawcy — bez narzędzi (pracownik)',
        'Mnożnik — z narzędziami (podwykonawca)',
        'Mnożnik — bez narzędzi (pracownik)',
      ]),
    )
  })

  it('offers the source entry in the picker of the client view', () => {
    const { columnToggleItems } = buildV2Grid({ view: 'client', stages: STAGES, crewAxis: 'both' })
    for (const id of MODE_IDS) {
      expect(columnToggleItems.some((item) => item.id === id)).toBe(true)
    }
  })

  it('starts hidden in every view, so nobody meets new columns unasked', () => {
    const planeIds = [...MODE_IDS, ...COEFF_IDS, ...PRICE_IDS]
    for (const id of planeIds) expect(DEFAULT_HIDDEN_COLUMNS.has(id)).toBe(false)

    for (const view of VIEWS) {
      const { columns, columnToggleItems } = buildV2Grid({ view, stages: STAGES })
      const visible = columns.map((column) => column.id)
      for (const id of planeIds) {
        expect(visible).not.toContain(id)
        expect(columnToggleItems.some((item) => item.id === id)).toBe(false)
      }
    }
  })

  it('a revealed plane column comes back even with that crew put away', () => {
    const revealed = planePriceKey('price', 'own_tools')
    const { columns } = buildV2Grid({
      view: 'client',
      stages: STAGES,
      crewAxis: 'none',
      revealedColumnIds: new Set([revealed]),
    })
    expect(columns.map((column) => column.id)).toContain(revealed)
  })

  it('survives the brutto reading, like the client price it derives from', () => {
    for (const plane of PLANES) {
      expect(axisAllows(planePriceKey('price', plane), 'gross')).toBe(true)
    }
  })

  it('reads on the same layer as the client price it derives from', () => {
    for (const layer of ['work', 'progress', 'both', 'none'] as const) {
      for (const plane of PLANES) {
        expect(layerAllows(planePriceKey('price', plane), layer)).toBe(layerAllows('price', layer))
        expect(layerAllows(planePriceKey('priceMode', plane), layer)).toBe(
          layerAllows('price', layer),
        )
        expect(layerAllows(planePriceKey('priceCoeff', plane), layer)).toBe(
          layerAllows('price', layer),
        )
      }
    }
  })

  it('stays editable in every view, source column or not', () => {
    const autoRow = { wToolsOverrideValue: null, wToolsOverrideCoeff: null } as never

    for (const view of VIEWS) {
      const columns = buildV2Columns({ view, stages: STAGES, crewAxis: 'both' })
      for (const id of PRICE_IDS) {
        const column = columns.find((entry) => entry.id === id)
        const disabled = column?.disabled
        expect(
          typeof disabled === 'function' ? disabled({ rowData: autoRow, rowIndex: 0 }) : disabled,
        ).toBeFalsy()
        expect(column?.deleteValue).toBeTypeOf('function')
        expect(column?.pasteValue).toBeTypeOf('function')
      }
    }
  })

  it('binds each column to its own plane, not to the active view', () => {
    const columns = buildV2Columns({ view: 'client', stages: STAGES, crewAxis: 'both' })
    const planeOf = (id: string) =>
      (columns.find((column) => column.id === id)?.columnData as { view?: string } | undefined)
        ?.view

    expect(planeOf(planePriceKey('price', 'w_tools'))).toBe('w_tools')
    expect(planeOf(planePriceKey('price', 'own_tools'))).toBe('own_tools')
    expect(planeOf(planePriceKey('priceCoeff', 'w_tools'))).toBe('w_tools')
    expect(planeOf(planePriceKey('priceCoeff', 'own_tools'))).toBe('own_tools')
  })
})
