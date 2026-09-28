import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Every synthetic grid row lives in the negative id namespace — the spacer (-2) and „Razem" (-1) at
// the top of it, then one band per section: headers below -1000, footers below -1000000. That leaves
// `id < 0` as the ONE test the grid's onChange filters on, so a synthetic row can never reach the
// editor's diff no matter how many kinds are added. Every id in the namespace is declared here so
// that predicate can be checked against the whole set; the components that render these rows import
// them back.
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

// Minimal stand-in rows: only `id` is read before a cell renders (rowKey), and the wrapper
// short-circuits on it before any other field is touched — hence the cast over a real row. The band
// additionally carries the section identity its cells read out.
export function makeTotalsRow(): KosztorysV2RowT {
  return { id: TOTALS_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSpacerRow(): KosztorysV2RowT {
  return { id: SPACER_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSectionHeaderRow(row: KosztorysV2RowT): KosztorysV2RowT {
  return {
    id: sectionHeaderRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}

export function makeSectionFooterRow(row: KosztorysV2RowT): KosztorysV2RowT {
  return {
    id: sectionFooterRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}
