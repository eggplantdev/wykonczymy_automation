import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { DEFAULT_HIDDEN_COLUMNS } from '@/lib/kosztorys/column-config'
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

function ids(opts: Partial<BuildV2ColumnsOptsT> & Pick<BuildV2ColumnsOptsT, 'view'>): string[] {
  return buildV2Columns({ stages: STAGES, ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('subcontractor rate columns, both planes', () => {
  it('assembles both planes’ rate in every view', () => {
    for (const view of VIEWS) {
      expect(ids({ view })).toEqual(expect.arrayContaining(PRICE_IDS))
    }
  })

  // „Źródło" is an edit control, not a figure to compare — the client view is where the offer is
  // read, and there is nothing there to set with it.
  it('assembles the source column only in the subcontractor views', () => {
    for (const view of ['w_tools', 'own_tools'] as const) {
      expect(ids({ view })).toEqual(expect.arrayContaining(MODE_IDS))
    }
    for (const id of MODE_IDS) expect(ids({ view: 'client' })).not.toContain(id)
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
    const { columnToggleItems } = buildV2Grid({ view: 'w_tools', stages: STAGES })
    const planeIds = [...MODE_IDS, ...PRICE_IDS]
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
      ]),
    )
  })

  it('offers no source entry in the picker of the client view', () => {
    const { columnToggleItems } = buildV2Grid({ view: 'client', stages: STAGES })
    for (const id of MODE_IDS) {
      expect(columnToggleItems.some((item) => item.id === id)).toBe(false)
    }
  })

  it('starts hidden in every view, so nobody meets new columns unasked', () => {
    for (const id of [...MODE_IDS, ...PRICE_IDS]) expect(DEFAULT_HIDDEN_COLUMNS.has(id)).toBe(true)

    const { columnToggleItems } = buildV2Grid({
      view: 'w_tools',
      stages: STAGES,
      isHidden: (id) => DEFAULT_HIDDEN_COLUMNS.has(id),
    })
    const planeIds = [...MODE_IDS, ...PRICE_IDS]
    for (const item of columnToggleItems.filter((entry) => planeIds.includes(entry.id))) {
      expect(item.visible).toBe(false)
    }
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
      }
    }
  })

  // The owner edits crew rates from the view he keeps open — the client price list — so the rate is
  // editable in EVERY view, „Źródło" beside it or not. Typing a number IS „kwota stała" and Delete is
  // the way back to „auto", which is what makes the column self-sufficient without the source picker.
  it('stays editable in every view, source column or not', () => {
    for (const view of VIEWS) {
      const columns = buildV2Columns({ view, stages: STAGES })
      for (const id of PRICE_IDS) {
        const column = columns.find((entry) => entry.id === id)
        expect(column?.disabled).toBeFalsy()
        expect(column?.deleteValue).toBeTypeOf('function')
        expect(column?.pasteValue).toBeTypeOf('function')
      }
    }
  })

  // The two planes must reach DIFFERENT stored fields. Same-id columns would have made this
  // impossible to express at all, which is why the id carries the plane.
  it('binds each column to its own plane, not to the active view', () => {
    const columns = buildV2Columns({ view: 'client', stages: STAGES })
    const planeOf = (id: string) =>
      (columns.find((column) => column.id === id)?.columnData as { view?: string } | undefined)
        ?.view

    expect(planeOf(planePriceKey('price', 'w_tools'))).toBe('w_tools')
    expect(planeOf(planePriceKey('price', 'own_tools'))).toBe('own_tools')
  })
})
