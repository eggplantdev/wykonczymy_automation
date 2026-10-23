// How far each reviewed AI draft is from the owner's kosztorys, in złoty, as the five tables of the
// „Trafność AI w kosztorysach” dashboard. Pure: `accuracy-report-prod.ts` feeds it from production.
import type { ItemT } from './prod-client'

export type ScoredItemT = Pick<
  ItemT,
  'aiPlannedQty' | 'plannedQty' | 'clientPrice' | 'changeReason' | 'description'
>

export type CaseInputT = {
  caseNumber: number
  slug: string
  investmentId: number
  items: readonly ScoredItemT[]
}

// A Powód saying the quantity was left low on purpose (zaniżone, niedoszacowane, rozliczane
// powykonawczo) means the AI's quantity was right.
const UNDERSTATEMENT = /zani|niedosza|powykonaw/i
const REPEAT_FLOOR = 3
const TOP_REPEATS = 12

type RowT = { investmentId: number; description: string; reason: string; ai: number; own: number; price: number }

const toRow = (investmentId: number, item: ScoredItemT): RowT => {
  const ai = item.aiPlannedQty ?? 0
  const reason = item.changeReason?.trim() ?? ''
  return {
    investmentId,
    description: item.description ?? '',
    reason,
    ai,
    own: UNDERSTATEMENT.test(reason) ? ai : item.plannedQty,
    price: item.clientPrice,
  }
}

const wrongZl = (row: RowT) => Math.abs(row.ai - row.own) * row.price
const sum = (rows: readonly RowT[], of: (row: RowT) => number) =>
  Math.round(rows.reduce((total, row) => total + of(row), 0))

const groupKey = (description: string) => description.toLowerCase().replace(/\s+/g, ' ')

export const shortPozycja = (name: string) =>
  (name.length > 60 ? name.split(' - ')[0].split(', ')[0] : name).slice(0, 70).replace(/[ ,]+$/, '')

export function scoreCases(cases: readonly CaseInputT[]) {
  const scored = cases.map((input) => ({
    ...input,
    rows: input.items.map((item) => toRow(input.investmentId, item)),
  }))

  const caseRows = scored.map(({ caseNumber, slug, rows }) => ({
    case: caseNumber,
    slug,
    ai_zl: sum(rows, (row) => row.ai * row.price),
    owner_zl: sum(rows, (row) => row.own * row.price),
    too_high_zl: sum(rows, (row) => Math.max(row.ai - row.own, 0) * row.price),
    too_low_zl: sum(rows, (row) => Math.max(row.own - row.ai, 0) * row.price),
  }))

  const reasons = scored.map(({ caseNumber, rows }) => ({
    case: caseNumber,
    wrong_zl: sum(rows, wrongZl),
    no_reason_zl: sum(rows, (row) => (row.reason ? 0 : wrongZl(row))),
  }))

  const errorTypes = scored.map(({ caseNumber, rows }) => ({
    case: caseNumber,
    missed_zl: sum(rows, (row) => (row.ai === 0 && row.own > 0 ? wrongZl(row) : 0)),
    extra_zl: sum(rows, (row) => (row.ai > 0 && row.own === 0 ? wrongZl(row) : 0)),
    qty_zl: sum(rows, (row) => (row.ai > 0 && row.own > 0 ? wrongZl(row) : 0)),
  }))

  const groups = new Map<string, RowT[]>()
  for (const row of scored.flatMap(({ rows }) => rows)) {
    if (row.ai === row.own) continue
    const key = groupKey(row.description)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const pozycje = [...groups.values()].map((rows) => ({
    name: rows.map((row) => row.description).toSorted()[0],
    inCases: new Set(rows.map((row) => row.investmentId)).size,
    reasonsWritten: rows.filter((row) => row.reason).length,
    zl: rows.reduce((total, row) => total + wrongZl(row), 0),
  }))

  const repeats = pozycje
    .filter((pozycja) => pozycja.inCases >= REPEAT_FLOOR)
    .toSorted((a, b) => b.zl - a.zl)
    .slice(0, TOP_REPEATS)
    .map((pozycja) => ({
      pozycja: shortPozycja(pozycja.name),
      wrong_in_cases: pozycja.inCases,
      reasons_written: pozycja.reasonsWritten,
      wrong_zl: Math.round(pozycja.zl),
    }))

  const howOften = [
    { group_order: 3, how_often: 'W 3 lub więcej przypadkach', min: 3, max: Infinity },
    { group_order: 2, how_often: 'W 2 przypadkach', min: 2, max: 2 },
    { group_order: 1, how_often: 'Tylko w 1 przypadku', min: 1, max: 1 },
  ]
  const repeatGroups = howOften
    .map(({ min, max, ...group }) => {
      const inGroup = pozycje.filter((pozycja) => pozycja.inCases >= min && pozycja.inCases <= max)
      return {
        ...group,
        wrong_zl: Math.round(inGroup.reduce((total, pozycja) => total + pozycja.zl, 0)),
        pozycje: inGroup.length,
      }
    })
    .filter((group) => group.pozycje > 0)

  return { cases: caseRows, reasons, error_types: errorTypes, repeat_groups: repeatGroups, repeats }
}

export type AccuracyTablesT = ReturnType<typeof scoreCases>

export function toCsv(rows: readonly Record<string, string | number>[]) {
  if (!rows.length) return ''
  const cell = (value: string | number) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const header = Object.keys(rows[0])
  return [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((line) => line.map(cell).join(','))
    .join('\n')
    .concat('\n')
}
