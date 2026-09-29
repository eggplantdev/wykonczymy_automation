import type { SelectOptionT } from '@/components/ui/simple-select'
import type { ColumnFieldT } from '@/lib/kosztorys/sheet-import/columns'
import type {
  CandidateColumnT,
  UnresolvedColumnsT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'

// Only the required ones are offered where the read was refused. An optional column nobody
// recognised is offered beside the report instead, where the import is still available and the pick
// is an improvement rather than a way out.
export function requiredFields(columns: UnresolvedColumnsT): ColumnFieldT[] {
  return columns.missingFields.filter((field) => field.required).map((field) => field.field)
}

/**
 * Candidate columns as options the owner can recognise in their own sheet. The letter leads because
 * that is what the sheet shows on screen; the header texts follow, all of them, because the two
 * rows often differ („Wartość netto przedmiar" on one, the client's address on the other) and it is
 * the difference that identifies the column.
 *
 * A column with no header text anywhere in the block is dropped — it names nothing, so an option
 * reading „AH — " would be a pick made blind.
 */
export function toColumnOptions(candidates: readonly CandidateColumnT[]): SelectOptionT[] {
  return candidates
    .filter((candidate) => candidate.labels.length > 0)
    .map((candidate) => ({
      value: String(candidate.column),
      label: `${candidate.letter} — ${candidate.labels.join(' / ')}`,
    }))
}
