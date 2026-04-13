import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Adds a trigram (pg_trgm) GIN index on transactions.amount cast to text.
 *
 * Why: The amount search filter does `WHERE amount::text LIKE '123%'`.
 * Without an index, Postgres does a sequential scan (reads every row).
 * The trigram GIN index lets Postgres do an index scan instead —
 * it splits text into 3-char chunks and builds an inverted index,
 * so LIKE patterns can be resolved via set intersections rather than
 * scanning every row.
 *
 * Used by:
 * - resolveAmountSearch() in src/lib/queries/transfers.ts (Payload query path)
 * - buildFieldCondition() in src/lib/db/sum-transfers.ts (raw SQL stats path)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- pg_trgm: Postgres extension for trigram-based text similarity and indexing
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- GIN index on amount::text using trigram ops — enables fast LIKE queries on the numeric column
    CREATE INDEX IF NOT EXISTS idx_transactions_amount_text_trgm
      ON transactions USING gin ((amount::text) gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_transactions_amount_text_trgm;
  `)
}
