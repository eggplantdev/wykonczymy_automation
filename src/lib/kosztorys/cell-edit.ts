import { parseCellDecimal } from '@/lib/utils/parse-decimal-input'

export type CellEditPolicyT<RowT> = {
  applyValue: (row: RowT, value: number) => RowT
  clear: (row: RowT) => RowT
  guard?: (row: RowT) => CellVerdictT | null
  restoredLabel: (row: RowT) => string
}

export type CellVerdictT = { severity: 'refuse' | 'warn'; message: string }

export type CellKeystrokeT<RowT> =
  | { kind: 'hold' }
  | { kind: 'blocked'; message: string }
  | { kind: 'accept'; row: RowT }

export type CellSettleT<RowT> =
  | { kind: 'commit'; row: RowT; warning: string | null }
  | { kind: 'clear'; row: RowT }
  | { kind: 'reject'; reason: 'blocked' | 'invalid' }

export function cellKeystroke<RowT>(
  raw: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT>,
): CellKeystrokeT<RowT> {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const row = policy.applyValue(rowData, parsed.value)
  const verdict = policy.guard?.(row) ?? null
  if (verdict?.severity === 'refuse') return { kind: 'blocked', message: verdict.message }
  return { kind: 'accept', row }
}

export function cellSettle<RowT>(
  draft: string,
  rowData: RowT,
  policy: CellEditPolicyT<RowT>,
): CellSettleT<RowT> {
  if (parseCellDecimal(draft).kind === 'empty') return { kind: 'clear', row: policy.clear(rowData) }

  const result = cellKeystroke(draft, rowData, policy)
  if (result.kind === 'accept')
    return { kind: 'commit', row: result.row, warning: policy.guard?.(result.row)?.message ?? null }
  return { kind: 'reject', reason: result.kind === 'blocked' ? 'blocked' : 'invalid' }
}

export function cellPaste<RowT>(raw: string, rowData: RowT, policy: CellEditPolicyT<RowT>): RowT {
  const parsed = parseCellDecimal(raw)
  if (parsed.kind === 'empty') return policy.clear(rowData)
  if (parsed.kind === 'invalid') return rowData
  const next = policy.applyValue(rowData, parsed.value)
  return policy.guard?.(next)?.severity === 'refuse' ? rowData : next
}

export type NumericFieldPolicyT<RowT> = CellEditPolicyT<RowT> & { read: (row: RowT) => number }

export function numericFieldPolicy<K extends string, RowT extends Record<K, number>>(
  field: K,
  format: (value: number) => string,
): NumericFieldPolicyT<RowT> {
  const write = (row: RowT, value: number) => ({ ...row, [field]: value }) as RowT
  return {
    read: (row) => row[field],
    applyValue: write,
    clear: (row) => write(row, 0),
    restoredLabel: (row) => format(row[field]),
  }
}
