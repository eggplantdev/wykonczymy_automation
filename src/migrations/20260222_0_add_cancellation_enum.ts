import { type MigrateUpArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add CANCELLATION enum value.
 * Must be a separate migration because PG doesn't allow using newly added
 * enum values in the same transaction they were created in.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_transactions_type" ADD VALUE IF NOT EXISTS 'CANCELLATION';
  `)
}

export async function down(): Promise<void> {
  // Cannot remove enum values in PG. They remain but are unused after rollback.
}
