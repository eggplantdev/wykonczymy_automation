import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE
  await db.execute(sql`
    ALTER TYPE "public"."enum_transactions_type"
      RENAME VALUE 'ADVANCE' TO 'ACCOUNT_FUNDING';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_transactions_type"
      RENAME VALUE 'ACCOUNT_FUNDING' TO 'ADVANCE';
  `)
}
