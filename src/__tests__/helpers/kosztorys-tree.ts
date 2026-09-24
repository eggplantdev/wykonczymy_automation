import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'

// The tree-level envelope (globalCoeffs / vatRate / settlementMode / materialsNetRate /
// globalDiscount / revision) is the same in every pure-calculation spec and is not what any of them
// is asserting — only `sections`, `stages` and `progress` carry a spec's actual scenario. Each new
// field on KosztorysTreeT used to force an edit in all seven of them (vatRate, then settlementMode);
// defaulting the envelope here makes the next one a one-line change (EX-592).

// `sections` is required rather than merely Partial: there is no meaningful default for it, and an
// omitted one would leave a spec silently asserting against an empty tree instead of failing to compile.
export function makeTree(
  scenario: Pick<KosztorysTreeT, 'sections'> & Partial<KosztorysTreeT>,
): KosztorysTreeT {
  return {
    stages: [],
    progress: [],
    globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
    vatRate: 0.23,
    settlementMode: 'NET',
    materialsNetRate: null,
    globalDiscount: { type: null, value: 0 },
    revision: '2026-01-01T00:00:00.000Z',
    ...scenario,
  }
}

// The fields a row's arithmetic doesn't turn on, so a spec only spells out id / description /
// plannedQty / clientPrice. The 'amount' overrides (flat 12/10) preserve the subcontractor values
// these specs used before the coefficient migration.
export const baseItem: Omit<KosztorysItemT, 'id' | 'description' | 'plannedQty' | 'clientPrice'> = {
  sectionId: 10,
  displayOrder: 0,
  unit: 'm2',
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  wToolsOverrideValue: 12,
  ownToolsOverrideValue: 10,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
}
