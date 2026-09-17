import { parseCellDecimal } from '@/lib/utils/parse-decimal-input'

/**
 * The edit contract every numeric cell runs on: keystrokes commit as they go, the typed text is held
 * as a draft, and leaving the cell settles — refused values roll the row back to what it held on
 * entry and owe the user a word.
 *
 * React-free on purpose (AGENTS.md), so a test needs no renderer and `useCellDraft` stays a thin
 * lifecycle around it. A policy is the whole difference between a plain number field, the rabat pair
 * and a guarded subcontractor price.
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
 * `hold` is the load-bearing case: writing an emptied field back mid-typing flips the cell out of
 * edit mode, which swaps the input for read-only text — the caret dies and the old value reappears
 * under the user's hands. Clearing takes effect only on leaving, via `cellSettle`.
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
 * Keystrokes commit as they go, so typing „2344000" writes 2, 23, 234 … until one is refused. Without
 * the rollback, walking away leaves the last accepted PREFIX standing as a value nobody chose.
 *
 * `reason` is what the caller announces: a refused value owes the user a word, because their number
 * is gone and an older one is on screen in its place — as does an unparseable one that displaced a
 * committed prefix. Only garbage that changed nothing is discarded silently.
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
 * The same rules as a typed cell, minus the draft — no caret to protect, so the settle happens at
 * once. Every numeric column routes its `pasteValue` here, so the clipboard and the keyboard can't
 * drift into two answers.
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
 * The default policy: any lone `number` field, any row shape, no domain. The two that carry domain
 * (the rabat pair, a subcontractor price) live in their own modules.
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
