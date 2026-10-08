import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source-level drift guard for the hand-written tree query, mirroring reference-data-sql-drift.
//
// Why this file needs one at all: `selectKosztorysTreeData` replaced five `payload.find` calls, which
// projected every column automatically, with a SELECT whose column list is maintained by hand. The
// failure it invites is silent, not loud — a mapper reading `row.client_price` when the SELECT no
// longer provides it gets `undefined`, and `num(undefined)` is 0. A price becomes zero and nothing
// throws. (A *renamed* column is the loud case: Postgres rejects the query outright.)
//
// tsc does not cover this. The mappers return domain types, so a field ADDED to KosztorysItemT fails
// to compile until it's mapped — but nothing ties the mapper's `row.X` reads back to the SELECT.

const SOURCE = readFileSync(path.resolve(__dirname, '../../../lib/db/kosztorys-tree.ts'), 'utf-8')

type CollectionT = {
  label: string
  table: string
  mapper: string
}

const COLLECTIONS: CollectionT[] = [
  { label: 'sections', table: 'kosztorys_sections', mapper: 'mapSection' },
  { label: 'items', table: 'kosztorys_items', mapper: 'mapOwnItem' },
  { label: 'item katalog overlay', table: 'kosztorys_items', mapper: 'mapCatalogueFields' },
  { label: 'stages', table: 'kosztorys_stages', mapper: 'mapStage' },
  { label: 'progress', table: 'stage_progress', mapper: 'mapProgress' },
]

// `[^()]*?` keeps the match inside one subselect: the outer SELECT wraps each of these in a
// coalesce(json_agg(...)) and a lazy `[\s\S]*?` would otherwise swallow the outer select list on its
// way to the first `FROM <table>`. It also keeps the progress subselect from reaching past its JOIN.
function selectColumns(table: string): Set<string> {
  const match = SOURCE.match(new RegExp(`SELECT\\s+([^()]*?)\\s+FROM\\s+${table}\\b`, 'i'))
  if (!match) return new Set()
  return new Set(
    match[1]!
      .replace(/::\w+/g, '')
      .split(',')
      .map((column) => {
        const trimmed = column.trim()
        const aliased = trimmed.match(/\bAS\s+(\w+)\s*$/i)
        if (aliased) return aliased[1]!.toLowerCase()
        const parts = trimmed.split('.')
        return parts[parts.length - 1]!.toLowerCase()
      })
      .filter(Boolean),
  )
}

function rowAccesses(block: string): Set<string> {
  return new Set([...block.matchAll(/row\.(\w+)/g)].map((match) => match[1]!.toLowerCase()))
}

function mapperBlock(mapper: string): string {
  // A mapper runs to the first blank line: not every one closes on a `})` (`mapCatalogueFields` is a
  // ternary), and a closing-brace anchor would run on into the next mapper and borrow its reads.
  const match = SOURCE.match(new RegExp(`const\\s+${mapper}\\b[\\s\\S]*?(?=\\n\\n|$)`))
  return match?.[0] ?? ''
}

describe('selectKosztorysTreeData SQL drift', () => {
  it.each(COLLECTIONS)(
    '$label: every row.X in $mapper is present in its SELECT',
    ({ table, mapper }) => {
      const columns = selectColumns(table)
      const accesses = rowAccesses(mapperBlock(mapper))

      expect(
        columns.size,
        `subselect for ${table} not found — did the query shape change?`,
      ).toBeGreaterThan(0)
      expect(
        accesses.size,
        `mapper ${mapper} not found — did it move or get renamed?`,
      ).toBeGreaterThan(0)

      const missing = [...accesses].filter((column) => !columns.has(column))
      expect(missing, `read in ${mapper} but missing from SELECT ... FROM ${table}`).toEqual([])
    },
  )

  // The investment scalars ride on the outer row rather than a subselect, so their available columns
  // are the `inv.*` list plus the four `AS <alias>` json_agg results.
  it('investment: every row.X in the outer mapping is present on the outer row', () => {
    const available = new Set([
      ...[...SOURCE.matchAll(/\binv\.(\w+)/g)].map((match) => match[1]!.toLowerCase()),
      ...[...SOURCE.matchAll(/\bAS\s+(\w+)/gi)].map((match) => match[1]!.toLowerCase()),
    ])

    // The body of selectKosztorysTreeData, from its return through the closing brace of the function.
    const body = SOURCE.match(/const row = res\.rows\[0\][\s\S]*?\n\}/)?.[0] ?? ''
    const accesses = rowAccesses(body)

    expect(available.size, 'outer column list not found').toBeGreaterThan(0)
    expect(accesses.size, 'selectKosztorysTreeData body not found').toBeGreaterThan(0)

    const missing = [...accesses].filter((column) => !available.has(column))
    expect(missing, 'read from the outer row but absent from the outer SELECT').toEqual([])
  })
})
