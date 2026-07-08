export type RgbT = { red: number; green: number; blue: number }

export function hexToRgb(hex: string): RgbT {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return {
    red: parseInt(full.slice(0, 2), 16) / 255,
    green: parseInt(full.slice(2, 4), 16) / 255,
    blue: parseInt(full.slice(4, 6), 16) / 255,
  }
}

// Heavily-whitened version of a color for whole-row backgrounds, so dark text
// stays readable while the hue is still recognizable at a glance.
export function tint(rgb: RgbT, amount = 0.82): RgbT {
  const mix = (c: number) => c + (1 - c) * amount
  return { red: mix(rgb.red), green: mix(rgb.green), blue: mix(rgb.blue) }
}

// Black or white text for a solid swatch, picked by perceived luminance.
export function textOn(rgb: RgbT): RgbT {
  const lum = 0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue
  return lum > 0.6 ? { red: 0, green: 0, blue: 0 } : { red: 1, green: 1, blue: 1 }
}

// Color that brands each summary key across the sheet (row tint + summary
// swatch), keyed by name. The three core expense types keep their hand-picked
// brand colors; any other key gets a stable, distinct color derived from its name
// (review T5.3) — so a category added in the admin is auto-colored, not gray, with
// no code change or schema field.
const TYPE_COLORS: Record<string, string> = {
  'Materiały budowlane': '#3b82f6',
  'Materiały wykończeniowe': '#22c55e',
  'Pozostałe koszty': '#f59e0b',
}
// Palette for auto-assigned colors (distinct hues, all legible once tinted).
const AUTO_COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a3a635', '#ef4444']
export const colorFor = (typeName: string): string => {
  if (TYPE_COLORS[typeName]) return TYPE_COLORS[typeName]
  // Deterministic name → palette index (small string hash), so the same key
  // always maps to the same color across syncs.
  let hash = 0
  for (let i = 0; i < typeName.length; i++) hash = (hash * 31 + typeName.charCodeAt(i)) | 0
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length]
}

export const MONEY_PATTERN = '#,##0.00 "zł"'
export const HEADER_BG: RgbT = { red: 0.17, green: 0.24, blue: 0.31 }
export const RAZEM_BG: RgbT = { red: 0.93, green: 0.94, blue: 0.95 }
export const WHITE: RgbT = { red: 1, green: 1, blue: 1 }

// Tab layout (0-indexed rows): row 1 holds a baked-in user-facing banner warning
// that manual edits to this tab are overwritten on next sync, row 2 holds the
// column headers, data starts at row 3. The banner is part of the table on purpose
// — owners who open the sheet in a new tab (bypassing the in-app notice) still
// see it. Reads/writes are header-driven (`resolveHeaders` scans for the header
// row by keyword), so shifting the header down doesn't affect the sync paths —
// only `setupTab`'s formatting math has to know these positions.
export const BANNER_ROW = 0
export const HEADER_ROW = 1
export const DATA_START_ROW = 2

export const BANNER_TEXT =
  '⚠ Edycje rób w aplikacji — ręczne zmiany w tej zakładce zostaną nadpisane przy następnej synchronizacji.'
export const BANNER_BG: RgbT = { red: 1, green: 0.949, blue: 0.8 } // soft amber, contrasts the dark header below
