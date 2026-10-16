import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

// Every synthetic grid row lives in the negative id namespace. That leaves `id < 0` as the ONE test
// the grid's onChange filters on, so a synthetic row can never reach the editor's diff.
export const TOTALS_ROW_ID = -1
export const SPACER_ROW_ID = -2
// A decimal order apart, so no real sectionId can carry a header id down into footer territory —
// section ids are DB serials and will not reach 999_000 in this lifetime.
export const SECTION_HEADER_ROW_BASE = -1_000
export const SECTION_FOOTER_ROW_BASE = -1_000_000

export function sectionHeaderRowId(sectionId: number): number {
  return SECTION_HEADER_ROW_BASE - sectionId
}

export function sectionFooterRowId(sectionId: number): number {
  return SECTION_FOOTER_ROW_BASE - sectionId
}

// Bounded above AND below: an unbounded floor would classify every footer as a header, which renders
// the wrong cell at the wrong row height under the wrong wash.
export function isSectionHeaderRow(id: number): boolean {
  return id <= SECTION_HEADER_ROW_BASE && id > SECTION_FOOTER_ROW_BASE
}

export function isSectionFooterRow(id: number): boolean {
  return id <= SECTION_FOOTER_ROW_BASE
}

export function isSyntheticRow(id: number): boolean {
  return id < 0
}

// Only `id` is read before a cell renders (rowKey), and the wrapper short-circuits on it before any
// other field is touched — hence the cast over a real row.
export function makeTotalsRow(): KosztorysV2RowT {
  return { id: TOTALS_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSpacerRow(): KosztorysV2RowT {
  return { id: SPACER_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSectionHeaderRow(row: SectionMetaT): KosztorysV2RowT {
  return {
    id: sectionHeaderRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}

export function makeSectionFooterRow(row: SectionMetaT): KosztorysV2RowT {
  return {
    id: sectionFooterRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}
