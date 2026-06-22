import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source-level drift guard for hand-written SQL in fetchReferenceData.
// For each entity, asserts that every `row.X` column read in the mapping
// is present in the corresponding SELECT. Catches the "forgot to add
// the column to SELECT" bug that hid `review` on investments.

const SOURCE = readFileSync(path.resolve(__dirname, '../lib/queries/reference-data.ts'), 'utf-8')

type EntityT = {
  label: string
  table: string
  mappingConst: string
}

const ENTITIES: EntityT[] = [
  { label: 'cash_registers', table: 'cash_registers', mappingConst: 'cashRegisters' },
  { label: 'investments', table: 'investments', mappingConst: 'investments' },
  { label: 'users', table: 'users', mappingConst: 'workers' },
  { label: 'other_categories', table: 'other_categories', mappingConst: 'otherCategories' },
  { label: 'expense_categories', table: 'expense_categories', mappingConst: 'expenseCategories' },
]

function extractSelectColumns(table: string): Set<string> {
  const re = new RegExp(`SELECT\\s+([\\s\\S]*?)\\s+FROM\\s+${table}\\b`, 'i')
  const match = SOURCE.match(re)
  if (!match) return new Set()
  // Resolve each select-list item to the column name it'll appear under in the
  // result row. Handles three shapes:
  //   `id`                                  → `id`
  //   `i.address`                           → `address`  (table alias prefix)
  //   `(k.x IS NOT NULL) AS has_sheet`      → `has_sheet` (explicit alias wins)
  return new Set(
    match[1]
      .replace(/::\w+/g, '') // drop type casts (::text, ::integer, …)
      .split(',')
      .map((c) => {
        const trimmed = c.trim()
        const aliased = trimmed.match(/\bAS\s+(\w+)\s*$/i)
        if (aliased) return aliased[1].toLowerCase()
        // Plain identifier, maybe prefixed by a table alias — take the last segment.
        const parts = trimmed.split('.')
        return parts[parts.length - 1].toLowerCase()
      })
      .filter(Boolean),
  )
}

function extractRowAccesses(mappingConst: string): Set<string> {
  // Find the mapping block: `const <name>: ... = <something>.rows.map(...)` up to its closing `}))`.
  const re = new RegExp(
    `const\\s+${mappingConst}\\b[\\s\\S]*?\\.rows\\.map\\([\\s\\S]*?\\}\\)\\)`,
    'm',
  )
  const match = SOURCE.match(re)
  if (!match) return new Set()
  const accesses = [...match[0].matchAll(/row\.(\w+)/g)].map((m) => m[1]!.toLowerCase())
  return new Set(accesses)
}

describe('fetchReferenceData SQL drift', () => {
  it.each(ENTITIES)(
    '$label: every row.X in mapping is present in SELECT',
    ({ table, mappingConst }) => {
      const selectCols = extractSelectColumns(table)
      const rowAccesses = extractRowAccesses(mappingConst)

      expect(selectCols.size, `SELECT for ${table} not found`).toBeGreaterThan(0)
      expect(rowAccesses.size, `mapping block for ${mappingConst} not found`).toBeGreaterThan(0)

      const missing = [...rowAccesses].filter((col) => !selectCols.has(col))
      expect(missing, `columns read in ${mappingConst} but missing from SELECT ${table}`).toEqual(
        [],
      )
    },
  )
})
