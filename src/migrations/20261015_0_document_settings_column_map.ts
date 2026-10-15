import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Document column settings stop storing the HIDDEN list and store one choice per column,
// `{ key: hidden }`, so a column added later reads as its code default instead of showing (EX-1033).
// Each stored array becomes a map over the ceiling as it stands today — copied here, not imported,
// because a migration must keep converting to the same map after the code ceiling moves on.
//
// Run straight AFTER the deploy: the old code reads an object as „never chosen" and serves the code
// default, which shows `price` and the other default-visible columns an owner may have hidden. The new
// code reads both shapes, so until this runs every link is served exactly as today.
const CLIENT_KEYS = [
  'note',
  'plannedQty',
  'currentPlannedQty',
  'stageQtySum',
  'unit',
  'price',
  'discountType',
  'discountValue',
  'discountAmount',
  'plannedNet',
  'currentPlannedNet',
  'net',
  'remaining',
  'stages',
  'stageValueNet',
  'donePercent',
  'plannedDonePercent',
]

const WORKER_KEYS = [
  'plannedQty',
  'currentPlannedQty',
  'stageQtySum',
  'unit',
  'rate',
  'plannedNetForPlane',
  'net',
  'remainingForPlane',
  'stages',
  'stageValueNet',
  'plannedDonePercent',
]

const TABLES = [
  { table: 'kosztorys_client_view', keys: CLIENT_KEYS },
  { table: 'kosztorys_client_view_defaults', keys: CLIENT_KEYS },
  { table: 'kosztorys_worker_view_settings', keys: WORKER_KEYS },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const { table, keys } of TABLES) {
    const keyArray = `ARRAY[${keys.map((key) => `'${key}'`).join(', ')}]::text[]`
    await db.execute(
      sql.raw(`
        UPDATE "${table}"
           SET "hidden_columns" = (
             SELECT jsonb_object_agg(key, "hidden_columns" ? key) FROM unnest(${keyArray}) AS key
           )
         WHERE jsonb_typeof("hidden_columns") = 'array';
      `),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const { table } of TABLES) {
    await db.execute(
      sql.raw(`
        UPDATE "${table}"
           SET "hidden_columns" = COALESCE(
             (SELECT jsonb_agg(key) FROM jsonb_each("hidden_columns") WHERE value = 'true'::jsonb),
             '[]'::jsonb
           )
         WHERE jsonb_typeof("hidden_columns") = 'object';
      `),
    )
  }
}
