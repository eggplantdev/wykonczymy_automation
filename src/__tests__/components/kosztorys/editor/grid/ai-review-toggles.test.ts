import { describe, expect, it } from 'vitest'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { OFFER_VISIBLE_COLUMNS } from '@/lib/kosztorys/offer-columns'
import { gridColumnIds, STAGES_7 } from '@/__tests__/helpers/grid-columns'

function ids(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return gridColumnIds({
    view: 'client',
    stages: STAGES_7,
    hasAiDraft: true,
    onRemoveItem: () => {},
    ...extra,
  }).filter((id) => id !== 'layerGap')
}

const sorted = (list: Iterable<string>) => [...list].sort()

describe('„Oferta" and „Przegląd AI" toggles', () => {
  it('„Oferta" alone shows exactly the offer columns', () => {
    expect(sorted(ids({ offerVisible: true }))).toEqual(sorted(OFFER_VISIBLE_COLUMNS))
  })

  it('„Oferta" with „Przegląd AI" adds the AI columns to the offer', () => {
    expect(sorted(ids({ offerVisible: true, aiColumnsShown: true }))).toEqual(
      sorted([...OFFER_VISIBLE_COLUMNS, ...AI_REVIEW_COLUMN_IDS]),
    )
  })

  it('revealing the AI columns overrides a stored hide, keeping the rest', () => {
    const hidden = new Set<string>(AI_REVIEW_COLUMN_IDS)
    const isHidden = (id: string) => hidden.has(id)

    expect(ids({ isHidden })).not.toContain('reviewStatus')
    const shown = ids({ isHidden, revealedColumnIds: new Set(AI_REVIEW_COLUMN_IDS) })
    for (const id of AI_REVIEW_COLUMN_IDS) expect(shown).toContain(id)
    expect(shown).toContain('net')
  })

  it('assembles no AI item columns without an AI draft', () => {
    const shown = ids({ hasAiDraft: false, revealedColumnIds: new Set(AI_REVIEW_COLUMN_IDS) })
    for (const id of ['aiPlannedQty', 'aiPlannedNet', 'reviewStatus', 'changeReason']) {
      expect(shown).not.toContain(id)
    }
    expect(shown).toContain('workNote')
  })

  it('leaves the investor preview to its own list', () => {
    const preview = { previewVisible: true, readOnly: true } as const
    expect(ids({ ...preview, offerVisible: true, aiColumnsShown: true })).toEqual(ids(preview))
  })
})
