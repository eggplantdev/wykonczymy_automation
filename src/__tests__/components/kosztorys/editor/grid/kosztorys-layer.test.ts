import { describe, expect, it } from 'vitest'
import {
  COLUMN_LABELS,
  COLUMN_LAYER,
  LAYER_NEUTRAL_COLUMNS,
} from '@/lib/kosztorys/columns/column-config'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { translationColumnLanguage } from '@/lib/kosztorys/translation-column-keys'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1', plane: null }),
  makeStage({ id: 9, ordinal: 2, label: 'Etap 2', plane: null }),
]

function ids(layer: LayerT, isHidden?: (id: string) => boolean): string[] {
  return buildV2Grid({ view: 'client', stages: STAGES, layer, isHidden })
    .columns.map((c) => c.id)
    .filter((id): id is string => id != null)
}

const PROGRESS_IDS = [
  'stageValueNet_7',
  'stageValueNet_9',
  'stageValueGross_7',
  'stageValueGross_9',
  'donePercent',
  'plannedDonePercent',
  'remaining',
  'remainingGross',
]
const WORK_IDS = ['plannedQty', 'price', 'plannedNet', 'net', 'gross', 'stage_7', 'stage_9']
const NEUTRAL_IDS = ['sectionName', 'description', 'stageQtySum'].filter((id) =>
  ids('both').includes(id),
)

describe('buildV2Grid — oś praca/postęp', () => {
  it('„bez filtra" renderuje dokładnie to co grid bez trybu — tryb jest opt-out', () => {
    expect(ids('both')).toEqual(
      buildV2Grid({ view: 'client', stages: STAGES }).columns.map((c) => c.id),
    )
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

  it('„none" zdejmuje obie warstwy, zostawia tylko kontekst', () => {
    const visible = ids('none')
    for (const id of [...WORK_IDS, ...PROGRESS_IDS]) expect(visible).not.toContain(id)
    for (const id of NEUTRAL_IDS) expect(visible).toContain(id)
  })

  it('kolumny kontekstu przeżywają każdy tryb', () => {
    expect(NEUTRAL_IDS.length).toBeGreaterThan(0)
    for (const layer of ['work', 'progress', 'both', 'none'] as const) {
      const visible = ids(layer)
      for (const id of NEUTRAL_IDS) expect(visible).toContain(id)
    }
  })

  it('piker wygrywa nad osią, która by kolumnę dopuściła', () => {
    expect(ids('progress', (id) => id === 'remaining')).not.toContain('remaining')
  })
})

describe('COLUMN_LAYER + LAYER_NEUTRAL_COLUMNS', () => {
  it('każdy otagowany klucz to prawdziwa kolumna', () => {
    for (const key of Object.keys(COLUMN_LAYER)) expect(COLUMN_LABELS).toHaveProperty(key)
  })

  it('każda kolumna kontekstu to prawdziwa kolumna', () => {
    // A translated opis is labelled off „Opis prac", not off an entry of its own.
    for (const key of LAYER_NEUTRAL_COLUMNS) {
      if (translationColumnLanguage(key) === null) expect(COLUMN_LABELS).toHaveProperty(key)
    }
  })
})
