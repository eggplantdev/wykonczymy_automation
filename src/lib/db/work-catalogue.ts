// No `server-only` here: the katalog seed script runs these helpers under tsx, where it throws
// (same reason as kosztorys-descriptions.ts).
import { sql } from '@payloadcms/db-vercel-postgres'
import type {
  CatalogueSeedItemT,
  CatalogueSourceItemT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { DbExecutorT } from './get-db'
import { numOrNull } from './row-coerce'

const CATALOGUE_COLUMNS = sql`id, description, category, unit, client_price, w_tools_rate, w_tools_rate_coeff, own_tools_rate, own_tools_rate_coeff, match_key`

const toRate = (value: unknown): number | null => (value == null ? null : Number(value))

export function toCatalogueItem(row: Record<string, unknown>): WorkCatalogueItemT {
  return {
    id: Number(row.id),
    description: row.description as string,
    category: (row.category as string | null) ?? null,
    unit: row.unit as string,
    clientPrice: Number(row.client_price),
    // NOT `Number(...)`: `Number(null)` is 0, which would silently turn every „auto" row into a
    // 0 zł stawka on read.
    wToolsRate: toRate(row.w_tools_rate),
    wToolsRateCoeff: toRate(row.w_tools_rate_coeff),
    ownToolsRate: toRate(row.own_tools_rate),
    ownToolsRateCoeff: toRate(row.own_tools_rate_coeff),
    matchKey: row.match_key as string,
  }
}

/**
 * The cennik rows named by id, returned in the CALLER's order — the wstawianie writes them in the
 * order the user ticked them, and SQL has no opinion about that order.
 */
export async function listCatalogueItemsByIds(
  db: DbExecutorT,
  ids: readonly number[],
): Promise<WorkCatalogueItemT[]> {
  if (ids.length === 0) return []
  const result = await db.execute(sql`
    SELECT ${CATALOGUE_COLUMNS}
    FROM work_catalogue_items
    WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql.raw(', '),
    )})
  `)
  const byId = new Map(result.rows.map((row) => [Number(row.id), toCatalogueItem(row)]))
  return ids.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
}

/** The whole cennik, in the order the katalog screen reads it. */
export async function listCatalogueItems(db: DbExecutorT): Promise<WorkCatalogueItemT[]> {
  const result = await db.execute(sql`
    SELECT ${CATALOGUE_COLUMNS}
    FROM work_catalogue_items
    ORDER BY category NULLS LAST, description
  `)
  return result.rows.map(toCatalogueItem)
}

/** What the seed subtracts before proposing anything. */
export async function listCatalogueMatchKeys(db: DbExecutorT): Promise<Set<string>> {
  const result = await db.execute(sql`SELECT match_key FROM work_catalogue_items`)
  return new Set(result.rows.map((row) => String(row.match_key)))
}

/**
 * One INSERT for the whole wsad, insert-only by construction: `ON CONFLICT DO NOTHING` on the
 * UNIQUE match_key is what makes a repeated run create zero rows without a prior SELECT deciding it
 * — and it is why this can never overwrite a cennik row somebody has since edited by hand.
 *
 * Returns how many rows were actually created (RETURNING skips the conflicting ones).
 */
export async function insertCatalogueItems(
  db: DbExecutorT,
  rows: readonly CatalogueSeedItemT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(
    (row) => sql`(
      ${row.description}, ${row.category}, ${row.unit},
      ${row.clientPrice},
      ${row.wToolsRate}, ${row.wToolsRateCoeff},
      ${row.ownToolsRate}, ${row.ownToolsRateCoeff},
      ${row.matchKey}
    )`,
  )
  const result = await db.execute(sql`
    INSERT INTO work_catalogue_items
      (description, category, unit, client_price,
       w_tools_rate, w_tools_rate_coeff, own_tools_rate, own_tools_rate_coeff, match_key)
    VALUES ${sql.join(values, sql.raw(', '))}
    ON CONFLICT (match_key) DO NOTHING
    RETURNING id
  `)
  return result.rows.length
}

/**
 * Everything „Zapisz do katalogu…" needs about one praca, read by its id: BOTH nadpisania of each
 * płaszczyzna and the sekcja it sits in (the proposed kategoria). Not the inwestycja's global
 * współczynniki — a plane with no nadpisanie goes to the cennik as „auto" rather than freezing a rate
 * nobody offered.
 */
export async function getCatalogueSourceItem(
  db: DbExecutorT,
  itemId: number,
): Promise<CatalogueSourceItemT | undefined> {
  const result = await db.execute(sql`
    SELECT ki.description, ki.unit, ki.client_price,
           ki.w_tools_override_value, ki.w_tools_override_coeff,
           ki.own_tools_override_value, ki.own_tools_override_coeff,
           ks.name AS section_name
    FROM kosztorys_items ki
    JOIN kosztorys_sections ks ON ks.id = ki.section_id
    WHERE ki.id = ${itemId}
  `)
  const row = result.rows[0]
  if (!row) return undefined

  return {
    description: (row.description as string | null) ?? '',
    unit: (row.unit as string | null) ?? '',
    sectionName: (row.section_name as string | null) ?? '',
    clientPrice: Number(row.client_price),
    wToolsOverrideValue: numOrNull(row.w_tools_override_value),
    wToolsOverrideCoeff: numOrNull(row.w_tools_override_coeff),
    ownToolsOverrideValue: numOrNull(row.own_tools_override_value),
    ownToolsOverrideCoeff: numOrNull(row.own_tools_override_coeff),
  }
}

/** Its presence is what decides „nowa" vs „nadpisz". */
export async function findCatalogueItemByKey(
  db: DbExecutorT,
  matchKey: string,
): Promise<WorkCatalogueItemT | undefined> {
  const result = await db.execute(sql`
    SELECT ${CATALOGUE_COLUMNS}
    FROM work_catalogue_items
    WHERE match_key = ${matchKey}
  `)
  const row = result.rows[0]
  return row ? toCatalogueItem(row) : undefined
}
