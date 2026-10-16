import { isSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'

// One line of `text-sm` (14px/20px)
const ROW_LINE_HEIGHT = 20
const ROW_VERTICAL_PADDING = 12

export const ITEM_ROW_HEIGHT = ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING
export const SECTION_BAND_ROW_HEIGHT = 52
export const HEADER_ROW_HEIGHT = 84
// The header rides in the same override map under a key no row id can take — ids are numeric strings.
export const HEADER_HEIGHT_KEY = 'header'

export function restingRowHeight(rowId: number): number {
  return isSectionHeaderRow(rowId) ? SECTION_BAND_ROW_HEIGHT : ITEM_ROW_HEIGHT
}

export function heightForLines(lines: number): number {
  return Math.max(ITEM_ROW_HEIGHT, Math.ceil(lines) * ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING)
}

export function fitRowHeight(rowId: number, contentLines: number): number {
  return Math.max(restingRowHeight(rowId), heightForLines(contentLines))
}

// a hand-edited or corrupted value would reach dsg's layout arithmetic as NaN and blank the grid.
export function resolveHeaderRowHeight(override?: number): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.max(HEADER_ROW_HEIGHT, Math.round(override))
  }
  return HEADER_ROW_HEIGHT
}

type ResolveOptsT = {
  isSectionBand: boolean
  override?: number
  contentLines?: number
  minLines?: number
}

export function resolveRowHeight({
  isSectionBand,
  override,
  contentLines,
  minLines,
}: ResolveOptsT): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.max(ITEM_ROW_HEIGHT, Math.round(override))
  }
  if (isSectionBand) return SECTION_BAND_ROW_HEIGHT
  if (minLines !== undefined) return heightForLines(Math.max(contentLines ?? 0, minLines))
  if (contentLines !== undefined) return heightForLines(contentLines)
  return ITEM_ROW_HEIGHT
}
