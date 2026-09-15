import { parseCellDecimal } from '@/lib/utils/parse-decimal-input'

/**
 * The edit contract every numeric cell in the grid runs on: keystrokes commit as they go, the typed
 * text is held as a draft by the cell, and leaving the cell settles — accepted values stay, refused
 * ones roll the row back to what it held on entry and owe the user a word.
 *
 * React-free on purpose (AGENTS.md): the rules live out here where a test needs no renderer at all,
 * and `useCellDraft` stays a thin lifecycle around them.
 *
 * A policy is the whole difference between a plain number field, the rabat pair and a guarded
 * subcontractor price — the rules below are the same for all three.
 */
export type CellEditPolicyT<RowT, EntryT> = {
  /** What the cell held on entry — what a refused edit rolls back to. */
  snapshot: (row: RowT) => EntryT
  sameEntry: (a: EntryT, b: EntryT) => boolean
  restore: (row: RowT, entry: EntryT) => RowT
  applyValue: (row: RowT, value: number) => RowT
  /** What an emptied field commits — 0 for a plain `number` field, `null` where „empty" is a state
   * of its own (a subcontractor stawka back to „auto"). */
  clear: (row: RowT) => RowT
  /** A refusal that stands regardless of what was typed (the subcontractor ceiling). */
  guard?: (row: RowT) => string | null
  /** The restored figure as the rollback announcement names it. */
  restoredLabel: (row: RowT) => string
}

export type CellKeystrokeT<RowT> =
  /** Text stands on screen, the row is untouched — an emptied field or half-typed garbage. */
  { kind: 'hold' } | { kind: 'blocked'; message: string } | { kind: 'commit'; row: RowT }

export type CellSettleT<RowT> =
  /** The row already says what the user left behind. */
  | { kind: 'keep' }
  | { kind: 'clear'; row: RowT }
  | {
      kind: 'rollback'
      reason: 'blocked' | 'invalid'
      /** `null` when the row already stands where the rollback would put it — announcement owed, write not. */
      row: RowT | null
      /** The row as it stands after the rollback, whether or not it had to be written. */
      restored: RowT
    }

/**
 * `hold` is the load-bearing case: an emptied field must NOT write the cleared value back to the
 * row mid-typing. Doing so flips the cell out of edit mode, which swaps the input for read-only
 * text — the caret dies and the old value reappears under the user's hands. Clearing only takes
 * effect once they leave, via `cellSettle`.
 */
export function cellKeystroke<RowT, EntryT>(
  raw: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT, EntryT>,
): CellKeystrokeT<RowT> {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const row = policy.applyValue(rowData, parsed.value)
  const refusal = policy.guard?.(row) ?? null
  if (refusal) return { kind: 'blocked', message: refusal }
  return { kind: 'commit', row }
}

/**
 * The rollback is what makes a rejected edit safe: keystrokes commit as they go, so typing
 * „2344000" writes 2, 23, 234 … until one is refused and the rest bounce. Without this, walking
 * away left the last accepted PREFIX standing as if the user had chosen it — a value they never
 * typed, in a cell they were told had failed.
 *
 * `reason` is what the caller announces: a refused value owes the user a word, because their number
 * is gone and an older one is on screen in its place. So does an unparseable one that displaced a
 * committed prefix — only garbage that changed nothing goes without a word, the way every text
 * field on earth discards it.
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
  if (result.kind === 'commit') return { kind: 'keep' }

  const restored = policy.restore(rowData, entry)
  const settled = policy.sameEntry(policy.snapshot(rowData), entry)
  return {
    kind: 'rollback',
    reason: result.kind === 'blocked' ? 'blocked' : 'invalid',
    row: settled ? null : restored,
    restored,
  }
}

/**
 * A pasted cell under the same rules as a typed one, minus the draft — there is no caret to protect,
 * so the settle happens at once. Every numeric column routes its `pasteValue` here, which is what
 * keeps „what arrives from the clipboard" and „what the user types" from drifting into two answers:
 * the guarded columns still refuse what a keystroke would have refused, and an emptied cell means
 * the same as an emptied field.
 */
export function cellPaste<RowT, EntryT>(
  raw: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT, EntryT>,
): RowT {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind === 'empty') return policy.clear(rowData)
  // Garbage in the clipboard leaves the row alone, the same answer typing it gets.
  if (parsed.kind === 'invalid') return rowData
  const next = policy.applyValue(rowData, parsed.value)
  return policy.guard?.(next) ? rowData : next
}

/**
 * The contract's default element: any lone `number` field, any row shape. It knows no domain — the
 * two policies that do (the rabat pair, a subcontractor price) live in their own modules; the
 * columns that reach for this one are listed at `decimal-column.tsx`.
 */
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
    // Zero, not null: every one of these fields is typed `number`, and the sheet reads a blank
    // position as nothing done rather than as unknown.
    clear: (row) => write(row, 0),
    restoredLabel: (row) => format(row[field]),
  }
}
