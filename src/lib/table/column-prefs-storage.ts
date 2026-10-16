import { type VisibilityState } from '@tanstack/react-table'
import { dropNonFiniteRanks, type ColumnRanksT } from '@/lib/table/column-order'

const VISIBILITY_PREFIX = 'table-columns:'
const ORDER_PREFIX = 'table-column-order:'
const TEXT_SIZE_PREFIX = 'table-text-size:'

// A stored `null` parses fine, then reaches consumers that index it (`columnVisibility[id] !== false`)
// and white-screens the table.
export function readVisibility(key: string): VisibilityState {
  const parsed = readStored(VISIBILITY_PREFIX + key)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).filter(([, hidden]) => typeof hidden === 'boolean'),
  )
}

function readStored(key: string): unknown {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // the layout stays for this session and is simply not remembered
  }
}

export function writeVisibility(key: string, state: VisibilityState) {
  persist(VISIBILITY_PREFIX + key, state)
}

export function readOrder(key: string): ColumnRanksT {
  const parsed = readStored(ORDER_PREFIX + key)
  if (typeof parsed !== 'object' || parsed === null) return {}
  return dropNonFiniteRanks(parsed as ColumnRanksT)
}

export function writeOrder(key: string, ranks: ColumnRanksT) {
  persist(ORDER_PREFIX + key, ranks)
}

export function readTextSize(key: string): unknown {
  return readStored(TEXT_SIZE_PREFIX + key)
}

export function writeTextSize(key: string, size: string) {
  persist(TEXT_SIZE_PREFIX + key, size)
}
