import { sql } from '@payloadcms/db-postgres'
import type { CollectionSlug } from 'payload'
import type { TransferTypeT } from '@/lib/constants/transfers'
import { MEDIA_HOLDER_TABLES } from '@/lib/media/relating-collections'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { DbExecutorT } from './get-db'
import { dateOrNull, textOrNull } from './row-coerce'
import { sqlList } from './sql-list'

export type DetachmentSourceT = { collection: CollectionSlug; field: string; id: number }

const isReferenced = sql.join(
  MEDIA_HOLDER_TABLES.map(
    (table) => sql`EXISTS (SELECT 1 FROM ${sql.identifier(table)} h WHERE h.media_id = m.id)`,
  ),
  sql.raw(' OR '),
)

export async function countMediaHolders(
  db: DbExecutorT,
  table: string,
  mediaId: number,
): Promise<number> {
  const { rows } = await db.execute(sql`
    SELECT count(*)::int AS total FROM ${sql.identifier(table)} WHERE media_id = ${mediaId}
  `)
  return Number(rows[0]?.total ?? 0)
}

export async function findReferencedMediaIds(
  db: DbExecutorT,
  mediaIds: number[],
): Promise<number[]> {
  if (mediaIds.length === 0) return []
  const { rows } = await db.execute(sql`
    SELECT m.id FROM media m WHERE m.id IN (${sqlList(mediaIds)}) AND (${isReferenced})
  `)
  return rows.map((row) => Number(row.id))
}

export async function recordDetachments(
  db: DbExecutorT,
  source: DetachmentSourceT,
  mediaIds: number[],
): Promise<void> {
  if (mediaIds.length === 0) return
  const values = sql.join(
    mediaIds.map(
      (mediaId) => sql`(${mediaId}, ${source.collection}, ${source.field}, ${source.id})`,
    ),
    sql.raw(', '),
  )
  await db.execute(sql`
    INSERT INTO media_detachments (media_id, from_collection, from_field, from_id)
    VALUES ${values}
    ON CONFLICT (media_id) WHERE restored_at IS NULL DO UPDATE SET
      from_collection = EXCLUDED.from_collection,
      from_field = EXCLUDED.from_field,
      from_id = EXCLUDED.from_id,
      detached_at = now()
  `)
}

export async function closeDetachments(db: DbExecutorT, mediaIds: number[]): Promise<void> {
  if (mediaIds.length === 0) return
  await db.execute(sql`
    UPDATE media_detachments SET restored_at = now()
    WHERE restored_at IS NULL AND media_id IN (${sqlList(mediaIds)})
  `)
}

export async function recordUnreferencedMedia(db: DbExecutorT): Promise<number> {
  const { rows } = await db.execute(sql`
    INSERT INTO media_detachments (media_id)
    SELECT m.id FROM media m WHERE NOT (${isReferenced})
    ON CONFLICT (media_id) WHERE restored_at IS NULL DO NOTHING
    RETURNING id
  `)
  return rows.length
}

export async function closeReferencedDetachments(db: DbExecutorT): Promise<number> {
  const { rows } = await db.execute(sql`
    UPDATE media_detachments d SET restored_at = now()
    FROM media m
    WHERE m.id = d.media_id AND d.restored_at IS NULL AND (${isReferenced})
    RETURNING d.id
  `)
  return rows.length
}

export async function selectExpiredDetachedMediaIds(
  db: DbExecutorT,
  retentionDays: number,
  limit: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT media_id FROM media_detachments
    WHERE restored_at IS NULL AND detached_at < now() - make_interval(days => ${retentionDays})
    ORDER BY detached_at
    LIMIT ${limit}
  `)
  return rows.map((row) => Number(row.media_id))
}

export async function selectOpenDetachedMediaIds(
  db: DbExecutorT,
  source: Omit<DetachmentSourceT, 'field'>,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT media_id FROM media_detachments
    WHERE restored_at IS NULL AND from_collection = ${source.collection} AND from_id = ${source.id}
  `)
  return rows.map((row) => Number(row.media_id))
}

export type DetachedFileRowT = {
  id: number
  mediaId: number
  filename: string
  detachedAt: Date
  source: DetachmentSourceT
  parent:
    | { kind: 'investment'; id: number; name: string; trashedAt: Date | null }
    | {
        kind: 'lead'
        id: number
        name: string | null
        email: string | null
        phone: string | null
        trashedAt: Date | null
      }
    | {
        kind: 'transaction'
        id: number
        type: TransferTypeT
        date: Date
        registerType: CashRegisterTypeT | null
      }
}

// A file still held elsewhere keeps its open entry until the sweep; listing it would offer to attach
// it to a second record.
export async function fetchDetachedFiles(
  db: DbExecutorT,
  detachmentId?: number,
): Promise<DetachedFileRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT d.id, d.media_id, m.filename, d.detached_at, d.from_collection, d.from_field, d.from_id,
      i.name AS investment_name, i.trashed_at AS investment_trashed_at,
      l.name AS lead_name, l.email AS lead_email, l.phone AS lead_phone,
      l.trashed_at AS lead_trashed_at,
      t.type AS transfer_type, t.date AS transfer_date, r.type AS register_type
    FROM media_detachments d
    JOIN media m ON m.id = d.media_id
    LEFT JOIN investments i ON d.from_collection = 'investments' AND i.id = d.from_id
    LEFT JOIN leads l
      ON d.from_collection = 'leads' AND l.id = d.from_id AND l.erased_at IS NULL
    LEFT JOIN transactions t ON d.from_collection = 'transactions' AND t.id = d.from_id
    LEFT JOIN cash_registers r ON r.id = t.source_register_id
    WHERE d.restored_at IS NULL
      AND (i.id IS NOT NULL OR l.id IS NOT NULL OR t.id IS NOT NULL)
      AND NOT (${isReferenced})
      ${detachmentId === undefined ? sql`` : sql`AND d.id = ${detachmentId}`}
    ORDER BY d.detached_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    mediaId: Number(row.media_id),
    filename: String(row.filename),
    detachedAt: new Date(row.detached_at as string),
    source: {
      collection: row.from_collection as CollectionSlug,
      field: String(row.from_field),
      id: Number(row.from_id),
    },
    parent: parentOf(row),
  }))
}

function parentOf(row: Record<string, unknown>): DetachedFileRowT['parent'] {
  const id = Number(row.from_id)
  if (row.from_collection === 'investments') {
    return {
      kind: 'investment',
      id,
      name: String(row.investment_name),
      trashedAt: dateOrNull(row.investment_trashed_at),
    }
  }
  if (row.from_collection === 'leads') {
    return {
      kind: 'lead',
      id,
      name: textOrNull(row.lead_name),
      email: textOrNull(row.lead_email),
      phone: textOrNull(row.lead_phone),
      trashedAt: dateOrNull(row.lead_trashed_at),
    }
  }
  return {
    kind: 'transaction',
    id,
    type: row.transfer_type as TransferTypeT,
    date: new Date(row.transfer_date as string),
    registerType: textOrNull(row.register_type) as CashRegisterTypeT | null,
  }
}
