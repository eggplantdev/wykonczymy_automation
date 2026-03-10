import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE enum_cash_registers_type ADD VALUE IF NOT EXISTS 'WORKER';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing a value from an enum.
  // Recreate the enum without WORKER and migrate existing rows.
  await db.execute(sql`
    UPDATE cash_registers SET type = 'AUXILIARY' WHERE type = 'WORKER';

    ALTER TYPE enum_cash_registers_type RENAME TO enum_cash_registers_type_old;

    CREATE TYPE enum_cash_registers_type AS ENUM ('MAIN', 'AUXILIARY', 'VIRTUAL');

    ALTER TABLE cash_registers
      ALTER COLUMN type TYPE enum_cash_registers_type
      USING type::text::enum_cash_registers_type;

    DROP TYPE enum_cash_registers_type_old;
  `)
}
