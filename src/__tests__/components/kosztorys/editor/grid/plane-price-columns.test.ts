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

// Both crews' rates on screen at once, in every view — the reading the owner asked for. The point of
// the columns is comparison, so the assertions are about the two planes standing SIDE BY SIDE and
// staying distinguishable; a spec that exercised one plane would pass on a build that renders the
// same plane twice.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
]

const PLANES: ToolPlaneT[] = ['w_tools', 'own_tools']
const VIEWS = ['client', 'w_tools', 'own_tools'] as const

const PRICE_IDS = PLANES.map((plane) => planePriceKey('price', plane))
const MODE_IDS = PLANES.map((plane) => planePriceKey('priceMode', plane))
const COEFF_IDS = PLANES.map((plane) => planePriceKey('priceCoeff', plane))

// `crewAxis: 'both'` on every build below is what „obie płaszczyzny naraz" now MEANS: the axis, not
// the picker, is the switch that puts a crew's columns on screen, so a build that leaves it at its
// default („żadna") is asking about a grid nobody opened the crews on.
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

  // The mnożnik travels with „Źródło", not with the stawka: it is the owner's control over a crew's
  // rate, so it lives behind the same gate rather than beside the figure it produces.
  it('assembles the mnożnik column in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(COEFF_IDS))
    }
  })

  // Guards the id, not a layout preference: the bare `price` is what each investment's client-view
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
    // Collapsing them into one entry the way the stage axes collapse would make the comparison
    // impossible to set up: you could never show one plane's rate without the other's.
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

  // Still „nobody meets them unasked", but it is the AXIS that holds that now, not a default-unticked
  // box. Two gates on one column do not compose: the picker is the stricter of the two, so a
  // remembered untick would quietly overrule the axis switch.
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

  // Six of the „Problemy" diagnostics are plane-bound („Stawka ujemna — bez narzędzi" and its five
  // siblings), and none of them consults the axis. So with the crew's columns put away, engaging one
  // hid pozycje and then showed nothing that explained why — the reveal has to outrank the axis
  // (owner, 2026-09-28). The picker it already outranked; the money axis and the layer it must not.
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

  // A crew is paid without VAT, so its rate has no brutto twin — the brutto reading must not take it
  // away. It bites in „Inwestor", the one view where the axis is live.
  it('survives the brutto reading, like the client price it derives from', () => {
    for (const plane of PLANES) {
      expect(axisAllows(planePriceKey('price', plane), 'gross')).toBe(true)
    }
  })

  // „Cena j.m." is one concept tagged once, and both axes resolve a plane id back to it — so the two
  // rate columns read on the work side exactly like the client price they derive from. Were the layer
  // to resolve differently from the money axis, one concept would sit on two sides of Praca/Postęp.
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

  // The owner edits crew rates from the view he keeps open — the client price list — so the rate is
  // editable in EVERY view, „Źródło" beside it or not. Typing a number IS „kwota stała" and Delete is
  // the way back to „auto", which is what makes the column self-sufficient without the source picker.
  //
  // „Editable" is asked of a row the kwota cell OWNS — on „własny mnożnik" the stawka is an output and
  // the column is deliberately closed there (see subcontractor-columns-delete.test.ts). The view must
  // not be what decides that.
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

  // The two planes must reach DIFFERENT stored fields. Same-id columns would have made this
  // impossible to express at all, which is why the id carries the plane.
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
