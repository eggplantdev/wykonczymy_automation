import type { SelectOptionT } from '@/components/ui/simple-select'
import type { ColumnFieldT } from '@/lib/kosztorys/sheet-import/columns'
import type {
  CandidateColumnT,
  UnresolvedColumnsT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'

export function requiredFields(columns: UnresolvedColumnsT): ColumnFieldT[] {
  return columns.missingFields.filter((field) => field.required).map((field) => field.field)
}

export function toColumnOptions(candidates: readonly CandidateColumnT[]): SelectOptionT[] {
  return candidates
    .filter((candidate) => candidate.labels.length > 0)
    .map((candidate) => ({
      value: String(candidate.column),
      label: `${candidate.letter} — ${candidate.labels.join(' / ')}`,
    }))
}
