// The palette a section can be pinned to: the nine chart hues at three tints (globals.css
// `--color-section-*`). Written out as literals, never assembled from `${hue}-${tint}` — Tailwind
// can't scan a template string, so a generated `bg-…` class would ship without its rule.
//
// `fill` feeds recharts, which takes the raw CSS var as a `fill` prop (the same indirection
// CHART_FILLS uses). The mid-tint rows deliberately point at `--color-chart-*` rather than their own
// `--color-section-*` alias: paintSlices subtracts pinned fills from the positional pool by STRING
// equality against CHART_FILLS, so switching to the alias would silently let a pinned section and an
// unpinned one render the same wedge. `swatch` is the picker's background utility; `label` is its
// Polish name, stored rather than derived from the key so the palette's vocabulary has one home.
//
// `rail` carries the section's hue into the grid as a single custom property — the row paints
// nothing itself; the rules that consume `--section-rail` (the gutter rail and the divider above a
// section's first row) live in globals.css under `.kosztorys-grid`. Two reasons for the indirection:
// dsg's stylesheet is UNLAYERED, so it outranks every `@layer utilities` rule regardless of
// specificity and a utility would need `!` on each of the 27 entries; and a custom property set on
// the row simply inherits down to the (absolutely positioned) cells, which no descendant selector
// written as a Tailwind variant can reach cleanly.
export const SECTION_COLORS = [
  {
    key: 'blue-soft',
    label: 'niebieski jasny',
    fill: 'var(--color-section-blue-soft)',
    swatch: 'bg-section-blue-soft',
    rail: '[--section-rail:var(--color-section-blue-soft)]',
    columnTint: '[--column-tint:var(--color-section-blue-soft)]',
  },
  {
    key: 'turquoise-soft',
    label: 'turkusowy jasny',
    fill: 'var(--color-section-turquoise-soft)',
    swatch: 'bg-section-turquoise-soft',
    rail: '[--section-rail:var(--color-section-turquoise-soft)]',
    columnTint: '[--column-tint:var(--color-section-turquoise-soft)]',
  },
  {
    key: 'teal-soft',
    label: 'morski jasny',
    fill: 'var(--color-section-teal-soft)',
    swatch: 'bg-section-teal-soft',
    rail: '[--section-rail:var(--color-section-teal-soft)]',
    columnTint: '[--column-tint:var(--color-section-teal-soft)]',
  },
  {
    key: 'green-soft',
    label: 'zielony jasny',
    fill: 'var(--color-section-green-soft)',
    swatch: 'bg-section-green-soft',
    rail: '[--section-rail:var(--color-section-green-soft)]',
    columnTint: '[--column-tint:var(--color-section-green-soft)]',
  },
  {
    key: 'yellow-soft',
    label: 'żółty jasny',
    fill: 'var(--color-section-yellow-soft)',
    swatch: 'bg-section-yellow-soft',
    rail: '[--section-rail:var(--color-section-yellow-soft)]',
    columnTint: '[--column-tint:var(--color-section-yellow-soft)]',
  },
  {
    key: 'orange-soft',
    label: 'pomarańczowy jasny',
    fill: 'var(--color-section-orange-soft)',
    swatch: 'bg-section-orange-soft',
    rail: '[--section-rail:var(--color-section-orange-soft)]',
    columnTint: '[--column-tint:var(--color-section-orange-soft)]',
  },
  {
    key: 'red-soft',
    label: 'czerwony jasny',
    fill: 'var(--color-section-red-soft)',
    swatch: 'bg-section-red-soft',
    rail: '[--section-rail:var(--color-section-red-soft)]',
    columnTint: '[--column-tint:var(--color-section-red-soft)]',
  },
  {
    key: 'pink-soft',
    label: 'różowy jasny',
    fill: 'var(--color-section-pink-soft)',
    swatch: 'bg-section-pink-soft',
    rail: '[--section-rail:var(--color-section-pink-soft)]',
    columnTint: '[--column-tint:var(--color-section-pink-soft)]',
  },
  {
    key: 'purple-soft',
    label: 'fioletowy jasny',
    fill: 'var(--color-section-purple-soft)',
    swatch: 'bg-section-purple-soft',
    rail: '[--section-rail:var(--color-section-purple-soft)]',
    columnTint: '[--column-tint:var(--color-section-purple-soft)]',
  },

  {
    key: 'blue',
    label: 'niebieski',
    fill: 'var(--color-chart-blue)',
    swatch: 'bg-section-blue',
    rail: '[--section-rail:var(--color-section-blue)]',
    columnTint: '[--column-tint:var(--color-section-blue)]',
  },
  {
    key: 'turquoise',
    label: 'turkusowy',
    fill: 'var(--color-chart-turquoise)',
    swatch: 'bg-section-turquoise',
    rail: '[--section-rail:var(--color-section-turquoise)]',
    columnTint: '[--column-tint:var(--color-section-turquoise)]',
  },
  {
    key: 'teal',
    label: 'morski',
    fill: 'var(--color-chart-teal)',
    swatch: 'bg-section-teal',
    rail: '[--section-rail:var(--color-section-teal)]',
    columnTint: '[--column-tint:var(--color-section-teal)]',
  },
  {
    key: 'green',
    label: 'zielony',
    fill: 'var(--color-chart-green)',
    swatch: 'bg-section-green',
    rail: '[--section-rail:var(--color-section-green)]',
    columnTint: '[--column-tint:var(--color-section-green)]',
  },
  {
    key: 'yellow',
    label: 'żółty',
    fill: 'var(--color-chart-yellow)',
    swatch: 'bg-section-yellow',
    rail: '[--section-rail:var(--color-section-yellow)]',
    columnTint: '[--column-tint:var(--color-section-yellow)]',
  },
  {
    key: 'orange',
    label: 'pomarańczowy',
    fill: 'var(--color-chart-orange)',
    swatch: 'bg-section-orange',
    rail: '[--section-rail:var(--color-section-orange)]',
    columnTint: '[--column-tint:var(--color-section-orange)]',
  },
  {
    key: 'red',
    label: 'czerwony',
    fill: 'var(--color-chart-red)',
    swatch: 'bg-section-red',
    rail: '[--section-rail:var(--color-section-red)]',
    columnTint: '[--column-tint:var(--color-section-red)]',
  },
  {
    key: 'pink',
    label: 'różowy',
    fill: 'var(--color-chart-pink)',
    swatch: 'bg-section-pink',
    rail: '[--section-rail:var(--color-section-pink)]',
    columnTint: '[--column-tint:var(--color-section-pink)]',
  },
  {
    key: 'purple',
    label: 'fioletowy',
    fill: 'var(--color-chart-purple)',
    swatch: 'bg-section-purple',
    rail: '[--section-rail:var(--color-section-purple)]',
    columnTint: '[--column-tint:var(--color-section-purple)]',
  },

  {
    key: 'blue-deep',
    label: 'niebieski ciemny',
    fill: 'var(--color-section-blue-deep)',
    swatch: 'bg-section-blue-deep',
    rail: '[--section-rail:var(--color-section-blue-deep)]',
    columnTint: '[--column-tint:var(--color-section-blue-deep)]',
  },
  {
    key: 'turquoise-deep',
    label: 'turkusowy ciemny',
    fill: 'var(--color-section-turquoise-deep)',
    swatch: 'bg-section-turquoise-deep',
    rail: '[--section-rail:var(--color-section-turquoise-deep)]',
    columnTint: '[--column-tint:var(--color-section-turquoise-deep)]',
  },
  {
    key: 'teal-deep',
    label: 'morski ciemny',
    fill: 'var(--color-section-teal-deep)',
    swatch: 'bg-section-teal-deep',
    rail: '[--section-rail:var(--color-section-teal-deep)]',
    columnTint: '[--column-tint:var(--color-section-teal-deep)]',
  },
  {
    key: 'green-deep',
    label: 'zielony ciemny',
    fill: 'var(--color-section-green-deep)',
    swatch: 'bg-section-green-deep',
    rail: '[--section-rail:var(--color-section-green-deep)]',
    columnTint: '[--column-tint:var(--color-section-green-deep)]',
  },
  {
    key: 'yellow-deep',
    label: 'żółty ciemny',
    fill: 'var(--color-section-yellow-deep)',
    swatch: 'bg-section-yellow-deep',
    rail: '[--section-rail:var(--color-section-yellow-deep)]',
    columnTint: '[--column-tint:var(--color-section-yellow-deep)]',
  },
  {
    key: 'orange-deep',
    label: 'pomarańczowy ciemny',
    fill: 'var(--color-section-orange-deep)',
    swatch: 'bg-section-orange-deep',
    rail: '[--section-rail:var(--color-section-orange-deep)]',
    columnTint: '[--column-tint:var(--color-section-orange-deep)]',
  },
  {
    key: 'red-deep',
    label: 'czerwony ciemny',
    fill: 'var(--color-section-red-deep)',
    swatch: 'bg-section-red-deep',
    rail: '[--section-rail:var(--color-section-red-deep)]',
    columnTint: '[--column-tint:var(--color-section-red-deep)]',
  },
  {
    key: 'pink-deep',
    label: 'różowy ciemny',
    fill: 'var(--color-section-pink-deep)',
    swatch: 'bg-section-pink-deep',
    rail: '[--section-rail:var(--color-section-pink-deep)]',
    columnTint: '[--column-tint:var(--color-section-pink-deep)]',
  },
  {
    key: 'purple-deep',
    label: 'fioletowy ciemny',
    fill: 'var(--color-section-purple-deep)',
    swatch: 'bg-section-purple-deep',
    rail: '[--section-rail:var(--color-section-purple-deep)]',
    columnTint: '[--column-tint:var(--color-section-purple-deep)]',
  },
] as const

export type SectionColorKeyT = (typeof SECTION_COLORS)[number]['key']

// The picker lays the palette out `grid-cols-9` — hue across, tint down — so SECTION_COLORS is stored
// row-major (nine jasne, nine bazowe, nine ciemne). Auto-assignment walks a THIRD order, because what
// the sequence has to optimize is telling ADJACENT sections apart: exhaust one tint band across the
// hue wheel before dropping to the next, and take the hues in a spread order rather than around the
// wheel, so neighbours never land on two steps of the same hue (blue then turquoise) — and never on
// three tints of one hue, which is what walking a hue's column top-to-bottom produced.
const HUE_SPREAD_ORDER = [0, 5, 2, 6, 3, 8, 4, 1, 7] as const
const TINTS_PER_HUE = 3
const HUE_COUNT = SECTION_COLORS.length / TINTS_PER_HUE

export const SECTION_COLOR_SEQUENCE: readonly SectionColorKeyT[] = SECTION_COLORS.map(
  (_, i) =>
    SECTION_COLORS[Math.floor(i / HUE_COUNT) * HUE_COUNT + HUE_SPREAD_ORDER[i % HUE_COUNT]].key,
)

// Nth section's colour, wrapping once the palette runs out — 28 sections is rarer than a crash would
// be forgivable, so it cycles rather than returning null.
export function sectionColorForIndex(index: number): SectionColorKeyT {
  return SECTION_COLOR_SEQUENCE[index % SECTION_COLOR_SEQUENCE.length]
}

const BY_KEY = new Map(SECTION_COLORS.map((c) => [c.key as string, c]))

// A section's stored colour is validated on read, not just on write: the column is plain text (the
// palette grows without a migration), so a key retired from SECTION_COLORS must degrade to "unpinned"
// rather than paint a slice with a dead CSS var.
export function isSectionColorKey(value: unknown): value is SectionColorKeyT {
  return typeof value === 'string' && BY_KEY.has(value)
}

export function sectionColorFill(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.fill : undefined
}

export function sectionColorRail(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.rail : undefined
}

export function sectionColorColumnTint(key: string | null | undefined): string | undefined {
  return key != null ? BY_KEY.get(key)?.columnTint : undefined
}
