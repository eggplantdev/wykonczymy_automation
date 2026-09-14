import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { LIVE_EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { toEquipmentEventRow, toEquipmentRow } from '@/lib/equipment/rows'
import type { EquipmentEventRowT, EquipmentRowT } from '@/lib/equipment/types'
import { getDb } from './get-db'

/**
 * „Gdzie jest" is the newest event per item, and it is computed by Postgres rather than by grouping
 * the whole log in JS the way the fleet does. The fleet can afford that — a few dozen cars — while
 * the register is deliberately open-ended: hundreds of tools, each with a handover per site visit.
 *
 * Ordered by `occurred_at`, never `created_at`: a handover typed in a week late must not become the
 * current state just because its row is the newest. `id DESC` only breaks a same-day tie, where the
 * insertion order is the sole remaining evidence of which happened last.
 */
const CURRENT_STATE = sql`
  SELECT DISTINCT ON (e.equipment_id)
    e.equipment_id,
    e.occurred_at,
    e.holder_id,
    e.warehouse_id,
    e.service_provider,
    e.investment_id
  FROM equipment_events e
  ORDER BY e.equipment_id, e.occurred_at DESC, e.id DESC
`

// One join set, written once: the listing, the location filter and the employee card all render the
// same row and must never disagree about what „u kogo" means.
const OVERVIEW_COLUMNS = sql`
  q.id, q.name, q.serial_number, q.make, q.model, q.status,
  q.purchase_date, q.warranty_until, q.purchase_price, q.note,
  c.occurred_at, c.holder_id, c.warehouse_id, c.service_provider, c.investment_id,
  u.name AS holder_name, w.name AS warehouse_name, i.name AS investment_name
`

const OVERVIEW_JOINS = sql`
  FROM equipment q
  LEFT JOIN current_state c ON c.equipment_id = q.id
  LEFT JOIN users u ON u.id = c.holder_id
  LEFT JOIN warehouses w ON w.id = c.warehouse_id
  LEFT JOIN investments i ON i.id = c.investment_id
`

export const loadEquipmentOverview = async (payload: Payload): Promise<EquipmentRowT[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH current_state AS (${CURRENT_STATE})
    SELECT ${OVERVIEW_COLUMNS}
    ${OVERVIEW_JOINS}
    ORDER BY q.name ASC, q.id ASC
  `)

  return result.rows.map(toEquipmentRow)
}

export const loadEquipmentById = async (
  payload: Payload,
  id: number,
): Promise<EquipmentRowT | null> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH current_state AS (${CURRENT_STATE})
    SELECT ${OVERVIEW_COLUMNS}
    ${OVERVIEW_JOINS}
    WHERE q.id = ${id}
  `)

  return result.rows.length === 0 ? null : toEquipmentRow(result.rows[0])
}

/**
 * The predicate is branched here rather than written as a `CASE` over both columns: a `CASE` is not
 * sargable, so neither `equipment_events_holder_idx` nor `..._warehouse_idx` could ever be used, and
 * this read runs uncached on every employee card. The „current" rule itself still lives in one place
 * (`CURRENT_STATE`), which is what the single-statement version was protecting.
 *
 * Retired statuses are excluded: a sold drill whose last event still names Marek is history, not
 * something he is holding — and this is the figure someone reads at a termination settlement.
 */
// A list literal rather than a bound array: the driver flattens a JS array into one parameter per
// element, which `= ANY($n)` then reads as a malformed array literal.
const LIVE_STATUSES = sql`(${sql.join(
  LIVE_EQUIPMENT_STATUSES.map((status) => sql`${status}`),
  sql.raw(', '),
)})`

export const loadEquipmentAtLocation = async (
  payload: Payload,
  target: { kind: 'holder' | 'warehouse'; id: number },
): Promise<EquipmentRowT[]> => {
  const db = await getDb(payload)

  const location =
    target.kind === 'holder'
      ? sql`c.holder_id = ${target.id}`
      : sql`c.warehouse_id = ${target.id}`

  const result = await db.execute(sql`
    WITH current_state AS (${CURRENT_STATE})
    SELECT ${OVERVIEW_COLUMNS}
    ${OVERVIEW_JOINS}
    WHERE ${location}
      AND q.status::text IN ${LIVE_STATUSES}
    ORDER BY q.name ASC, q.id ASC
  `)

  return result.rows.map(toEquipmentRow)
}

export const loadEquipmentHistory = async (
  payload: Payload,
  equipmentId: number,
): Promise<EquipmentEventRowT[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT
      e.id, e.occurred_at, e.holder_id, e.warehouse_id, e.service_provider,
      e.investment_id, e.cost, e.note, e.created_by_id,
      u.name AS holder_name,
      w.name AS warehouse_name,
      i.name AS investment_name,
      a.name AS created_by_name
    FROM equipment_events e
    LEFT JOIN users u ON u.id = e.holder_id
    LEFT JOIN users a ON a.id = e.created_by_id
    LEFT JOIN warehouses w ON w.id = e.warehouse_id
    LEFT JOIN investments i ON i.id = e.investment_id
    WHERE e.equipment_id = ${equipmentId}
    ORDER BY e.occurred_at DESC, e.id DESC
  `)

  return result.rows.map(toEquipmentEventRow)
}
