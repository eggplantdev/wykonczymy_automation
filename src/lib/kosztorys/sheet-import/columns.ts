export const HEADER_BLOCK_ROWS = 3

// Matching „wykonano" here is what keeps a 10-etap sheet from importing 20 etapy.
export const STAGE_MARKER = 'wykonano'

export type ColumnFieldT =
  | 'plannedQty'
  | 'measuredQty'
  | 'unit'
  | 'clientPrice'
  | 'discount'
  | 'netValue'
  | 'comment'

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

export const OPTIONAL_FIELDS = ['discount', 'comment', 'measuredQty'] as const

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

// All literals are pre-folded — no diacritics,
// lowercase — because they are compared against `fold()` output.
export const FIELD_MATCHERS: Record<ColumnFieldT, MatcherT> = {
  plannedQty: exactly('przedmiar'),
  measuredQty: exactly('pomiar z natury', 'pomiar'),
  unit: exactly('j.m.', 'j.m', 'jm', 'jednostka', 'jednostka miary'),
  clientPrice: exactly('cena j.m.', 'cena j.m', 'cena jm.', 'cena jm', 'cena jednostkowa'),
  // „rabat 8%" — the owner writes the rate into the header on some sheets.
  discount: startsWith('rabat'),
  // Most sheets split the column in two: „Wartość netto przedmiar" (S) and „Wartość
  // netto pomiar z natury" (T). T is the one the sheet counts so only the Pomiar side is named here
  netValue: exactly('wartosc netto', 'wartosc netto pomiar z natury', 'wartosc pomiar z natury'),
  comment: exactly('komentarz'),
}

export type RateGroupT = 'wToolsRate' | 'ownToolsRate'

// „cena j.m."
// alone matches three columns in a `zakres pracy` tab — the client price plus one per price list —
// so matching it on its own picks the client price and imports every rate at full price.
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

export const RATE_UNIT_PRICE_MATCHER: MatcherT = FIELD_MATCHERS.clientPrice

export type FooterRowKeyT = 'plannedNet' | 'executedNet'

// a footer label typed into the opis column looks
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
