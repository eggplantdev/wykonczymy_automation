import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create enum type
  await db.execute(sql`
    CREATE TYPE enum_cash_registers_type AS ENUM ('MAIN', 'AUXILIARY');
  `)

  // Add column with default AUXILIARY
  await db.execute(sql`
    ALTER TABLE cash_registers
      ADD COLUMN type enum_cash_registers_type NOT NULL DEFAULT 'AUXILIARY';
  `)

  // Set "Kasa glowna" to MAIN
  await db.execute(sql`
    UPDATE cash_registers SET type = 'MAIN' WHERE name = 'Kasa główna';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE cash_registers DROP COLUMN IF EXISTS type;
    DROP TYPE IF EXISTS enum_cash_registers_type;
  `)
}
