// The header block is rows 1–3 and a field may be labelled on ANY of them: „rabat" appears on row 1
// only, „komentarz" on row 3 only, „j.m." on both with different wording. Three rows is what every
// sheet seen so far uses; the constant exists so a fourth-row sheet is one edit away.
export const HEADER_BLOCK_ROWS = 3

// Row 2 is the only thing separating the quantity columns from the money columns: row 1 labels both
// blocks identically (the money block's row 1 is literally `=D1`), and row 3 gets renamed to crew
// names on sheets where a crew owns an etap. Matching „wykonano" here is what keeps a 10-etap sheet
// from importing 20 etapy.
export const STAGE_MARKER = 'wykonano'

const DIACRITICS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
}

// Stricter than `@/lib/google/sheet-configs`'s `normalize`, which only trims and lowercases. These
// headers are hand-typed by the owner over years, and the same sheet spells one banner „cennik z
// narzędziami" on one tab and „cennik z narzedziami" on another. Folding diacritics and collapsing
// internal whitespace is what makes those the same string. The shared `normalize` is left alone —
// it governs the tabs this app WRITES, where the headers are ours and exact matching is a feature.
export function fold(cell: unknown): string {
  return String(cell ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => DIACRITICS[char] ?? char)
    .replace(/\s+/g, ' ')
    .trim()
}

export type ColumnFieldT =
  | 'plannedQty'
  | 'measuredQty'
  | 'unit'
  | 'clientPrice'
  | 'discount'
  | 'netValue'
  | 'comment'

// The label shown to the owner when a column can't be resolved — the sheet's own wording, so the
// message points at a cell they can actually find.
export const FIELD_LABELS: Record<ColumnFieldT, string> = {
  plannedQty: 'Przedmiar',
  measuredQty: 'Pomiar z natury',
  unit: 'j.m.',
  clientPrice: 'Cena j.m.',
  discount: 'rabat',
  netValue: 'Wartość netto',
  comment: 'komentarz',
}

export const COLUMN_FIELDS = Object.keys(FIELD_LABELS) as ColumnFieldT[]

export const isColumnField = (value: unknown): value is ColumnFieldT =>
  typeof value === 'string' && (COLUMN_FIELDS as string[]).includes(value)

// Optional fields resolve to `undefined` instead of failing. Rabat is genuinely absent on some
// sheets (Ryżowa 66/127 has no such column at all) and „komentarz" is never read — it is resolved
// only so the preview can show the owner that we saw it. „Pomiar z natury" is optional for a
// stronger reason: it feeds nothing but a reconciliation hint, so a sheet without it must import
// exactly as before rather than fail on a column nobody's money depends on.
export const OPTIONAL_FIELDS = ['discount', 'comment', 'measuredQty'] as const

// The optional fields as a type, so anything that has to say something per-optional-field (the
// preview's „czego nie odczytaliśmy" list) is exhaustive by the compiler rather than by review.
export type OptionalFieldT = (typeof OPTIONAL_FIELDS)[number]

const OPTIONAL_FIELD_SET: ReadonlySet<ColumnFieldT> = new Set(OPTIONAL_FIELDS)

export const isOptionalField = (field: ColumnFieldT): field is OptionalFieldT =>
  OPTIONAL_FIELD_SET.has(field)

type MatcherT = (folded: string) => boolean

const exactly =
  (...accepted: string[]): MatcherT =>
  (value) =>
    accepted.includes(value)

const startsWith =
  (prefix: string): MatcherT =>
  (value) =>
    value.startsWith(prefix)

// Spelling variants observed across the real sheets. All literals are pre-folded — no diacritics,
// lowercase — because they are compared against `fold()` output.
export const FIELD_MATCHERS: Record<ColumnFieldT, MatcherT> = {
  plannedQty: exactly('przedmiar'),
  measuredQty: exactly('pomiar z natury', 'pomiar'),
  unit: exactly('j.m.', 'j.m', 'jm', 'jednostka', 'jednostka miary'),
  clientPrice: exactly('cena j.m.', 'cena j.m', 'cena jm.', 'cena jm', 'cena jednostkowa'),
  // „rabat 8%" — the owner writes the rate into the header on some sheets.
  discount: startsWith('rabat'),
  // Most sheets since 2026-07 split the column in two: „Wartość netto przedmiar" (S) and „Wartość
  // netto pomiar z natury" (T), row 3 dropping the „netto". T is the one the sheet counts — the
  // section total sums T and „pozostało do rozliczenia" is T minus the etapy — so only the Pomiar
  // side is named here, which also keeps S from making the match ambiguous.
  netValue: exactly('wartosc netto', 'wartosc netto pomiar z natury', 'wartosc pomiar z natury'),
  comment: exactly('komentarz'),
}

export type RateGroupT = 'wToolsRate' | 'ownToolsRate'

// A rate column is identified by a PAIR: the group banner and the row-3 sub-label. „cena j.m."
// alone matches three columns in a `zakres pracy` tab — the client price plus one per price list —
// so matching it on its own picks the client price and imports every rate at full price.
//
// The banners are named on TWO different axes depending on who set the sheet up: by tooling („z
// narzędziami" / „bez narzędzi") or by who does the work („podwykonawca" / „pracownik"). They mean
// the same split — a subcontractor brings their own tools, our employee uses ours — and the
// arithmetic agrees: the second group is always the cheaper one. An unrecognised banner is a
// failure that names it, never a guess by column order: silently swapping the two price lists
// would put the wrong cost on every praca and stay invisible until the margin is wrong.
export const RATE_GROUP_MATCHERS: Record<RateGroupT, MatcherT> = {
  wToolsRate: (value) =>
    value.startsWith('cennik z narzedziami') || value.startsWith('cennik podwykonawca'),
  ownToolsRate: (value) =>
    value.startsWith('cennik bez narzedzi') || value.startsWith('cennik pracownik'),
}

export const RATE_GROUP_LABELS: Record<RateGroupT, string> = {
  wToolsRate: 'cennik z narzędziami / podwykonawca',
  ownToolsRate: 'cennik bez narzędzi / pracownik',
}

// Within a rate group, the per-unit price rather than the „wartość suma" total.
export const RATE_UNIT_PRICE_MATCHER: MatcherT = FIELD_MATCHERS.clientPrice

export type FooterRowKeyT = 'plannedNet' | 'executedNet'

// The named summary rows under the last praca. Prefix-matched because the owner's wording drifts
// („wartość netto przedmiar", „R netto - suma prac wykonannych"). They live here rather than beside
// the comparison because the PARSER needs them too: a footer label typed into the opis column looks
// exactly like a section name, and only this list tells them apart.
export const FOOTER_ROWS: ReadonlyArray<{
  key: FooterRowKeyT
  label: string
  matches: MatcherT
}> = [
  { key: 'plannedNet', label: 'wartość netto', matches: startsWith('wartosc netto') },
  {
    key: 'executedNet',
    label: 'R netto - suma prac wykonannych',
    matches: startsWith('r netto'),
  },
]

export const isFooterLabel = (folded: string): boolean =>
  FOOTER_ROWS.some(({ matches }) => matches(folded))

const SUPERSCRIPT_DIGITS: Record<string, string> = { '¹': '1', '²': '2', '³': '3' }

// The j.m. member of a praca's identity, folded harder than `fold()` because a unit is an
// abbreviation and the owner abbreviates it inconsistently across sheets and years: `szt` / `szt.`,
// `mb` / `m.b.`, `m2` / `m²`. Left as `fold()` alone those are distinct units, so the same praca
// arrives from two sheets as two catalogue entries — and the second one carries a price nobody
// compared against the first.
//
// Deliberately NOT a typo dictionary: `klp` (38×) and `n2` (1×) stay separate from `kpl` and `m2`.
// Guessing that a letter was mistyped decides a praca's price on the strength of a hunch; the report
// flags them instead and a human decides. Same reason the description half is not fuzzy-matched.
export function foldUnit(unit: unknown): string {
  return fold(unit)
    .replace(/[¹²³]/g, (char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .replace(/\./g, '')
    .trim()
}
