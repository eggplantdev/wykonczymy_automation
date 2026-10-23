// The scored tables as the five CSVs in <ai-cases>/accuracy/, keyed by ai-cases case number and slug
// so they stay comparable with the files already committed there.
import type { AiAccuracyTablesT } from '@/lib/kosztorys/ai-accuracy'

export function toCsvTables(tables: AiAccuracyTablesT, caseNumberOf: ReadonlyMap<number, number>) {
  const caseNumber = (investmentId: number) => {
    const found = caseNumberOf.get(investmentId)
    if (found === undefined) throw new Error(`investment ${investmentId} has no ai-cases case`)
    return found
  }
  return {
    cases: tables.cases.map(({ investmentId, label, ...figures }) => ({
      case: caseNumber(investmentId),
      slug: label,
      ...figures,
    })),
    reasons: tables.reasons.map(({ investmentId, ...figures }) => ({
      case: caseNumber(investmentId),
      ...figures,
    })),
    error_types: tables.error_types.map(({ investmentId, ...figures }) => ({
      case: caseNumber(investmentId),
      ...figures,
    })),
    repeat_groups: tables.repeat_groups,
    repeats: tables.repeats,
  }
}

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
