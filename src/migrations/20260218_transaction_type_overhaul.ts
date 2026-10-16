import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Step 2: Schema changes + data migration.
 * Enum values were already added in the _enums migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add target_register_id column with FK to cash_registers
  await db.execute(sql`
    ALTER TABLE "transactions"
      ADD COLUMN "target_register_id" integer;

    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_target_register_id_cash_registers_id_fk"
      FOREIGN KEY ("target_register_id")
      REFERENCES "public"."cash_registers"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "transactions_target_register_idx"
      ON "transactions" USING btree ("target_register_id");
  `)

  // 2. Migrate existing DEPOSIT rows → OTHER_DEPOSIT
  await db.execute(sql`
    UPDATE "transactions"
      SET "type" = 'OTHER_DEPOSIT'
      WHERE "type" = 'DEPOSIT';
  `)

  // 3. Clear cash_register_id for EMPLOYEE_EXPENSE (no longer uses registers)
  await db.execute(sql`
    UPDATE "transactions"
      SET "cash_register_id" = NULL
      WHERE "type" = 'EMPLOYEE_EXPENSE';
  `)

  // 4. Drop NOT NULL on cash_register_id (EMPLOYEE_EXPENSE won't have one)
  await db.execute(sql`
    ALTER TABLE "transactions"
      ALTER COLUMN "cash_register_id" DROP NOT NULL;
  `)

  // Note: DEPOSIT value stays in the enum (PG cannot remove enum values).
  // It's unused — no UI option creates it.
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Restore NOT NULL on cash_register_id
  await db.execute(sql`
    ALTER TABLE "transactions"
      ALTER COLUMN "cash_register_id" SET NOT NULL;
  `)

  // Migrate OTHER_DEPOSIT back to DEPOSIT
  await db.execute(sql`
    UPDATE "transactions"
      SET "type" = 'DEPOSIT'
      WHERE "type" = 'OTHER_DEPOSIT';
  `)

  // Drop target_register_id column (also drops FK + index)
  await db.execute(sql`
    ALTER TABLE "transactions"
      DROP CONSTRAINT IF EXISTS "transactions_target_register_id_cash_registers_id_fk";

    DROP INDEX IF EXISTS "transactions_target_register_idx";

    ALTER TABLE "transactions"
      DROP COLUMN IF EXISTS "target_register_id";
  `)
}
