// How far each reviewed AI draft is from the owner's kosztorys, in złoty: the tables behind the
// „Trafność AI w kosztorysach” page and the ai-cases accuracy CSVs.
export type AiAccuracyItemT = {
  aiPlannedQty: number | null
  plannedQty: number
  clientPrice: number
  changeReason: string | null
  description: string | null
}

export type AiAccuracyCaseInputT = {
  investmentId: number
  label: string
  items: readonly AiAccuracyItemT[]
}

// A Powód saying the quantity was left low on purpose (zaniżone, niedoszacowane, rozliczane
// powykonawczo) means the AI's quantity was right.
const UNDERSTATEMENT = /zani|niedosza|powykonaw/i
const REPEAT_FLOOR = 3
const TOP_REPEATS = 12
export const AI_ACCURACY_WINDOW = 5

type RowT = {
  investmentId: number
  description: string
  reason: string
  ai: number
  own: number
  price: number
}

const toRow = (investmentId: number, item: AiAccuracyItemT): RowT => {
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

export function scoreCases(cases: readonly AiAccuracyCaseInputT[]) {
  const scored = cases.map((input) => ({
    ...input,
    rows: input.items.map((item) => toRow(input.investmentId, item)),
  }))

  const caseRows = scored.map(({ investmentId, label, rows }) => ({
    investmentId,
    label,
    ai_zl: sum(rows, (row) => row.ai * row.price),
    owner_zl: sum(rows, (row) => row.own * row.price),
    too_high_zl: sum(rows, (row) => Math.max(row.ai - row.own, 0) * row.price),
    too_low_zl: sum(rows, (row) => Math.max(row.own - row.ai, 0) * row.price),
  }))

  const reasons = scored.map(({ investmentId, rows }) => ({
    investmentId,
    wrong_zl: sum(rows, wrongZl),
    no_reason_zl: sum(rows, (row) => (row.reason ? 0 : wrongZl(row))),
  }))

  const errorTypes = scored.map(({ investmentId, rows }) => ({
    investmentId,
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

export type AiAccuracyTablesT = ReturnType<typeof scoreCases>

// Without the zero guards a kosztorys with no priced pozycja turns every figure into NaN.
const rightPercent = (ownerZl: number, wrongZl: number) =>
  ownerZl ? Math.round(100 - (100 * wrongZl) / ownerZl) : 0
const sharePercent = (part: number, whole: number) => (whole ? Math.round((100 * part) / whole) : 0)

type CaseFiguresT = {
  investmentId: number
  label: string
  aiZl: number
  ownerZl: number
  tooHighZl: number
  tooLowZl: number
  wrongZl: number
  noReasonZl: number
  reasonWrongZl: number
  missedZl: number
  extraZl: number
  qtyZl: number
}

const total = (cases: readonly CaseFiguresT[], of: (figures: CaseFiguresT) => number) =>
  cases.reduce((sum, figures) => sum + of(figures), 0)

function summarizeWindow(cases: readonly CaseFiguresT[]) {
  const right = rightPercent(
    total(cases, (figures) => figures.ownerZl),
    total(cases, (figures) => figures.wrongZl),
  )
  const missedZl = total(cases, (figures) => figures.missedZl)
  const extraZl = total(cases, (figures) => figures.extraZl)
  const qtyZl = total(cases, (figures) => figures.qtyZl)
  const splitZl = missedZl + extraZl + qtyZl
  return {
    labels: cases.map((figures) => figures.label),
    rightPercent: right,
    wrongPer100: 100 - right,
    noReasonPercent: sharePercent(
      total(cases, (figures) => figures.noReasonZl),
      total(cases, (figures) => figures.reasonWrongZl),
    ),
    missedZl,
    extraZl,
    qtyZl,
    splitZl,
    extraPercent: sharePercent(extraZl, splitZl),
  }
}

export type AiAccuracyWindowT = ReturnType<typeof summarizeWindow>

// The cases' order is the page's time axis: „last 5” and „latest” read it from the end.
export function summarizeAccuracy(tables: AiAccuracyTablesT) {
  const figures: CaseFiguresT[] = tables.cases.map((row, index) => ({
    investmentId: row.investmentId,
    label: row.label,
    aiZl: row.ai_zl,
    ownerZl: row.owner_zl,
    tooHighZl: row.too_high_zl,
    tooLowZl: row.too_low_zl,
    wrongZl: row.too_high_zl + row.too_low_zl,
    noReasonZl: tables.reasons[index].no_reason_zl,
    reasonWrongZl: tables.reasons[index].wrong_zl,
    missedZl: tables.error_types[index].missed_zl,
    extraZl: tables.error_types[index].extra_zl,
    qtyZl: tables.error_types[index].qty_zl,
  }))

  const cases = figures.map((caseFigures, index) => {
    const window = figures.slice(Math.max(0, index - AI_ACCURACY_WINDOW + 1), index + 1)
    return {
      investmentId: caseFigures.investmentId,
      label: caseFigures.label,
      ownerZl: caseFigures.ownerZl,
      wrongZl: caseFigures.wrongZl,
      rightPercent: Math.max(0, rightPercent(caseFigures.ownerZl, caseFigures.wrongZl)),
      rollingPercent: Math.max(
        0,
        rightPercent(
          total(window, (windowFigures) => windowFigures.ownerZl),
          total(window, (windowFigures) => windowFigures.wrongZl),
        ),
      ),
      noReasonPercent: sharePercent(caseFigures.noReasonZl, caseFigures.reasonWrongZl),
    }
  })

  const first = figures.at(0)
  const example = first && {
    label: first.label,
    ownerZl: first.ownerZl,
    aiZl: first.aiZl,
    priceGapZl: Math.abs(first.aiZl - first.ownerZl),
    priceMatchPercent: rightPercent(first.ownerZl, Math.abs(first.aiZl - first.ownerZl)),
    tooHighZl: first.tooHighZl,
    tooLowZl: first.tooLowZl,
    wrongZl: first.wrongZl,
    rightPercent: rightPercent(first.ownerZl, first.wrongZl),
  }

  const repeatTotalZl = tables.repeat_groups.reduce((sum, group) => sum + group.wrong_zl, 0)
  const repeatGroups = tables.repeat_groups
    .map((group) => ({
      groupOrder: group.group_order,
      howOften: group.how_often,
      pozycje: group.pozycje,
      wrongZl: group.wrong_zl,
      sharePercent: sharePercent(group.wrong_zl, repeatTotalZl),
    }))
    .toSorted((a, b) => b.groupOrder - a.groupOrder)

  return {
    cases,
    windows: {
      all: summarizeWindow(figures),
      last: summarizeWindow(figures.slice(-AI_ACCURACY_WINDOW)),
      latest: summarizeWindow(figures.slice(-1)),
    },
    example,
    repeatGroups,
    repeatedSharePercent: sharePercent(
      tables.repeat_groups
        .filter((group) => group.group_order >= 2)
        .reduce((sum, group) => sum + group.wrong_zl, 0),
      repeatTotalZl,
    ),
    repeats: tables.repeats.map((repeat) => ({
      pozycja: repeat.pozycja,
      wrongInCases: repeat.wrong_in_cases,
      reasonsWritten: repeat.reasons_written,
      wrongZl: repeat.wrong_zl,
    })),
  }
}

export type AiAccuracyT = ReturnType<typeof summarizeAccuracy>
export type AiAccuracyCaseScoreT = AiAccuracyT['cases'][number]
