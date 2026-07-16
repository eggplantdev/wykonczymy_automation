import { describe, expect, it } from 'vitest'
import { COLUMN_LABELS, COLUMN_LAYER, LAYER_NEUTRAL_COLUMNS } from '@/lib/kosztorys/constants'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { KosztorysStageT } from '@/types/kosztorys'

// Asserts the RENDERED column ids, like the money-axis test: the ids are what the user sees, and
// going through buildV2Columns proves the predicate reaches the stage namespace. The three buckets
// are derived from a one-sided tag (only progress is in COLUMN_LAYER), so these tests pin that
// derivation — work = untagged-and-not-neutral, progress = tagged, neutral = always visible.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1' },
  { id: 9, ordinal: 2, label: 'Etap 2' },
]

function ids(layer: LayerT, isHidden?: (id: string) => boolean): string[] {
  return buildV2Columns({ view: 'client', stages: STAGES, layer, isHidden })
    .map((c) => c.id)
    .filter((id): id is string => id != null)
}

// The tracker columns visible under the DEFAULT progress-display ('values'): the per-etap
// netto/brutto pair plus the row-level readouts. The percent columns belong to the progress axis and
// are covered separately below, so the layer axis is tested without the two axes fighting.
const PROGRESS_IDS = [
  'stageValueNet_7',
  'stageValueNet_9',
  'stageValueGross_7',
  'stageValueGross_9',
  'donePercent',
  'remaining',
  'remainingGross',
]
// Untagged, not neutral → treated as the work layer.
const WORK_IDS = ['plannedQty', 'price', 'plannedNet', 'net', 'gross', 'stage_7', 'stage_9']
// Always visible; filtered to those actually rendered in the client view so the test never assumes
// a column exists.
const NEUTRAL_IDS = ['sectionName', 'description', 'stageQtySum'].filter((id) =>
  ids('both').includes(id),
)

describe('buildV2Columns — oś praca/postęp', () => {
  it('„bez filtra" renderuje dokładnie to co grid bez trybu — tryb jest opt-out', () => {
    expect(ids('both')).toEqual(buildV2Columns({ view: 'client', stages: STAGES }).map((c) => c.id))
  })

  it('„postęp" zdejmuje każdą kolumnę pracy, zostawia tracker + kontekst', () => {
    const visible = ids('progress')
    for (const id of WORK_IDS) expect(visible).not.toContain(id)
    for (const id of PROGRESS_IDS) expect(visible).toContain(id)
    for (const id of NEUTRAL_IDS) expect(visible).toContain(id)
  })

  it('„praca" zdejmuje każdą kolumnę trackera, zostawia pracę + kontekst', () => {
    const visible = ids('work')
    for (const id of PROGRESS_IDS) expect(visible).not.toContain(id)
    for (const id of WORK_IDS) expect(visible).toContain(id)
    for (const id of NEUTRAL_IDS) expect(visible).toContain(id)
  })

  it('kolumny kontekstu przeżywają każdy tryb', () => {
    expect(NEUTRAL_IDS.length).toBeGreaterThan(0)
    for (const layer of ['work', 'progress', 'both'] as const) {
      const visible = ids(layer)
      for (const id of NEUTRAL_IDS) expect(visible).toContain(id)
    }
  })

  // Untagged, non-neutral columns are the work layer: shown under „praca", hidden under „postęp".
  it('kolumna bez tagu liczy się jako praca (fail-open ku pracy)', () => {
    expect(ids('work')).toContain('price')
    expect(ids('progress')).not.toContain('price')
  })

  it('piker wygrywa nad osią, która by kolumnę dopuściła', () => {
    expect(ids('progress', (id) => id === 'remaining')).not.toContain('remaining')
  })

  it('kolumny etapów zwijają się po grupie, nie po id etapu', () => {
    const visible = ids('progress')
    expect(visible).toContain('stageValueNet_7')
    expect(visible).toContain('stageValueNet_9')
    expect(ids('work')).not.toContain('stageValueNet_7')
  })

  // Percent kolumny należą do trackera (oś postępu je pokazuje), więc „praca" musi je zdjąć nawet w
  // trybie procentowym — sprawdzamy złożenie z osią progress-display, gdzie percent jest widoczny.
  it('„praca" chowa kolumny „% etapu" też w trybie procentowym', () => {
    const percentVisible = buildV2Columns({
      view: 'client',
      stages: STAGES,
      layer: 'progress',
      progressDisplay: 'percent',
    }).map((c) => c.id)
    expect(percentVisible).toContain('stageValuePercent_7')

    const percentUnderWork = buildV2Columns({
      view: 'client',
      stages: STAGES,
      layer: 'work',
      progressDisplay: 'percent',
    }).map((c) => c.id)
    expect(percentUnderWork).not.toContain('stageValuePercent_7')
  })
})

// Catches the rename that silently un-tags a layer column — the tag and the label live in one file.
describe('COLUMN_LAYER + LAYER_NEUTRAL_COLUMNS', () => {
  it('każdy otagowany klucz to prawdziwa kolumna', () => {
    for (const key of Object.keys(COLUMN_LAYER)) expect(COLUMN_LABELS).toHaveProperty(key)
  })

  it('każda kolumna kontekstu to prawdziwa kolumna', () => {
    for (const key of LAYER_NEUTRAL_COLUMNS) expect(COLUMN_LABELS).toHaveProperty(key)
  })
})
