import { parseCellDecimal } from '@/lib/utils/parse-decimal-input'

export type CellEditPolicyT<RowT, EntryT> = {
  snapshot: (row: RowT) => EntryT
  sameEntry: (a: EntryT, b: EntryT) => boolean
  restore: (row: RowT, entry: EntryT) => RowT
  applyValue: (row: RowT, value: number) => RowT
  clear: (row: RowT) => RowT
  guard?: (row: RowT) => CellVerdictT | null
  restoredLabel: (row: RowT) => string
}

export type CellVerdictT = { severity: 'refuse' | 'warn'; message: string }

export type CellKeystrokeT<RowT> =
  | { kind: 'hold' }
  | { kind: 'blocked'; message: string }
  | { kind: 'commit'; row: RowT }

export type CellSettleT<RowT> =
  | { kind: 'keep'; warning: string | null }
  | { kind: 'clear'; row: RowT }
  | {
      kind: 'rollback'
      reason: 'blocked' | 'invalid'
      /** `null` when the row already stands where the rollback would put it — announcement owed, write not. */
      row: RowT | null
      restored: RowT
    }

/**
 * `hold` is the load-bearing case: writing an emptied field back mid-typing flips the cell out of
 * edit mode, which swaps the input for read-only text — the caret dies and the old value reappears
 * under the user's hands.
 */
export function cellKeystroke<RowT, EntryT>(
  raw: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT, EntryT>,
): CellKeystrokeT<RowT> {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const row = policy.applyValue(rowData, parsed.value)
  const verdict = policy.guard?.(row) ?? null
  if (verdict?.severity === 'refuse') return { kind: 'blocked', message: verdict.message }
  // Keystrokes commit as they go, so a warning on this result would fire on „6",
  // „66", „660" — three toasts for one number.
  return { kind: 'commit', row }
}

/**
 * Without the rollback, walking away leaves the last accepted PREFIX standing as a value nobody chose.
 */
export function cellSettle<RowT, EntryT>(
  draft: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT, EntryT>,
  entry: EntryT,
): CellSettleT<RowT> {
  const parsed = parseCellDecimal(draft)
  if (parsed.kind === 'empty') return { kind: 'clear', row: policy.clear(rowData) }

  const result = cellKeystroke(draft, rowData, policy)
  if (result.kind === 'commit')
    return { kind: 'keep', warning: policy.guard?.(result.row)?.message ?? null }

  const restored = policy.restore(rowData, entry)
  const settled = policy.sameEntry(policy.snapshot(rowData), entry)
  return {
    kind: 'rollback',
    reason: result.kind === 'blocked' ? 'blocked' : 'invalid',
    row: settled ? null : restored,
    restored,
  }
}

export function cellPaste<RowT, EntryT>(
  raw: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT, EntryT>,
): RowT {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind === 'empty') return policy.clear(rowData)
  if (parsed.kind === 'invalid') return rowData
  const next = policy.applyValue(rowData, parsed.value)
  return policy.guard?.(next)?.severity === 'refuse' ? rowData : next
}

export function numericFieldPolicy<K extends string, RowT extends Record<K, number>>(
  field: K,
  format: (value: number) => string,
): CellEditPolicyT<RowT, number> {
  const write = (row: RowT, value: number) => ({ ...row, [field]: value }) as RowT
  return {
    snapshot: (row) => row[field],
    sameEntry: (a, b) => a === b,
    restore: write,
    applyValue: write,
    clear: (row) => write(row, 0),
    restoredLabel: (row) => format(row[field]),
  }
}
