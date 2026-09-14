import { isSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'

// One line of `text-sm` (14px/20px) plus the breathing room that makes 32px the resting row —
// so `heightForLines(1)` lands exactly on the height the grid has always used.
const ROW_LINE_HEIGHT = 20
const ROW_VERTICAL_PADDING = 12

export const ITEM_ROW_HEIGHT = ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING
// The band opening a section is chrome, not a row of figures — hence a fixed resting height that no
// label length changes. A drag still moves it, like any other row.
export const SECTION_BAND_ROW_HEIGHT = 52
// The column labels wrap onto two lines at this height („Pozostało netto (względem przedmiaru)"),
// which is why the header has never been the resting 32.
export const HEADER_ROW_HEIGHT = 56
// The header is one row, not one per id, so it rides in the same override map under a key no row id
// can take — ids are numeric strings.
export const HEADER_HEIGHT_KEY = 'header'

// What a row sits at when nobody has dragged it and nothing forces it taller — the floor a drag may
// not cross and the floor a fit starts from. One function so the band's exception is stated once.
export function restingRowHeight(rowId: number): number {
  return isSectionHeaderRow(rowId) ? SECTION_BAND_ROW_HEIGHT : ITEM_ROW_HEIGHT
}

export function heightForLines(lines: number): number {
  return Math.max(ITEM_ROW_HEIGHT, Math.ceil(lines) * ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING)
}

// A band's label is one line and its resting height is 52, so the floor inside heightForLines is the
// wrong one for it.
export function fitRowHeight(rowId: number, contentLines: number): number {
  return Math.max(restingRowHeight(rowId), heightForLines(contentLines))
}

type ResolveOptsT = {
  // Only its RESTING height — a band the owner dragged obeys the drag like any other row.
  isSectionBand: boolean
  // What the owner dragged this row to, if they ever did. Absent for every untouched row, which is
  // why the map behind it stays small.
  override?: number
  // What the content needs — the client's preview, where nobody can drag and everything must show.
  contentLines?: number
}

export function resolveRowHeight({ isSectionBand, override, contentLines }: ResolveOptsT): number {
  // A drag outranks everything else — the band's fixed height included: the owner asking for a flat
  // row means a flat row, even where the description no longer fits. That is what the popover is
  // still there for.
  // Finite, not merely present: the map is parsed straight out of localStorage, and a hand-edited
  // or corrupted value would otherwise reach dsg's layout arithmetic as NaN and blank the grid.
  if (override !== undefined && Number.isFinite(override)) {
    return Math.max(ITEM_ROW_HEIGHT, Math.round(override))
  }
  if (isSectionBand) return SECTION_BAND_ROW_HEIGHT
  if (contentLines !== undefined) return heightForLines(contentLines)
  return ITEM_ROW_HEIGHT
}
