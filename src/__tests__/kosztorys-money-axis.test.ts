import { describe, expect, it } from 'vitest'
import { COLUMN_LABELS, COLUMN_MONEY_AXIS, AXIS_EXEMPT_COLUMNS } from '@/lib/kosztorys/constants'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { KosztorysStageT } from '@/types/kosztorys'

// Asserts the RENDERED column ids rather than axisAllows' verdicts: the ids are what the user sees,
// and going through buildV2Columns is what proves the predicate reaches the stage namespace at all.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1' },
  { id: 9, ordinal: 2, label: 'Etap 2' },
]

function ids(axis: MoneyAxisT, isHidden?: (id: string) => boolean): string[] {
  return buildV2Columns({ view: 'client', stages: STAGES, moneyAxis: axis, isHidden })
    .map((c) => c.id)
    .filter((id): id is string => id != null)
}

const GROSS_IDS = ['priceGross', 'discountAmountGross', 'plannedGross', 'gross', 'remainingGross']
const NET_IDS = ['discountAmount', 'plannedNet', 'net', 'remaining']
const NEUTRAL_IDS = ['plannedQty', 'unit', 'discountType', 'stage_7', 'stage_9']

describe('buildV2Columns — oś netto/brutto', () => {
  it('„oba" renderuje dokładnie to co grid bez trybu — tryb jest opt-out', () => {
    expect(ids('both')).toEqual(buildV2Columns({ view: 'client', stages: STAGES }).map((c) => c.id))
  })

  it('„netto" zdejmuje każdą kolumnę brutto', () => {
    const visible = ids('net')
    for (const id of GROSS_IDS) expect(visible).not.toContain(id)
    for (const id of NET_IDS) expect(visible).toContain(id)
  })

  it('„brutto" zdejmuje kolumny netto, ale nigdy ceny j.m.', () => {
    const visible = ids('gross')
    for (const id of NET_IDS) expect(visible).not.toContain(id)
    expect(visible).toContain('price')
    for (const id of GROSS_IDS) expect(visible).toContain(id)
  })

  it('kolumny bez osi przeżywają każdy tryb (fail-open)', () => {
    for (const axis of ['net', 'gross', 'both'] as const) {
      for (const id of NEUTRAL_IDS) expect(ids(axis)).toContain(id)
    }
  })

  it('piker wygrywa nad osią, która by kolumnę dopuściła', () => {
    expect(ids('gross', (id) => id === 'gross')).not.toContain('gross')
  })

  it('kolumny etapów zwijają się po grupie, nie po id etapu', () => {
    const visible = ids('net')
    expect(visible).toContain('stageValueNet_7')
    expect(visible).toContain('stageValueNet_9')
    expect(visible).not.toContain('stageValueGross_7')
    expect(visible).not.toContain('stageValueGross_9')
  })
})

// Catches the rename that silently un-tags a money column — the tag and the label live in one file
// precisely so this stays a one-line check.
describe('COLUMN_MONEY_AXIS', () => {
  it('każdy otagowany klucz to prawdziwa kolumna', () => {
    for (const key of Object.keys(COLUMN_MONEY_AXIS)) expect(COLUMN_LABELS).toHaveProperty(key)
  })

  it('każda kolumna zwolniona z trybu jest mimo to otagowana', () => {
    for (const key of AXIS_EXEMPT_COLUMNS) expect(COLUMN_MONEY_AXIS).toHaveProperty(key)
  })
})
