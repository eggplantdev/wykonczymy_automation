import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactions_type" ADD VALUE 'DEPOSIT' BEFORE 'INVESTMENT_EXPENSE';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactions_type";
  CREATE TYPE "public"."enum_transactions_type" AS ENUM('INVESTMENT_EXPENSE', 'ADVANCE', 'EMPLOYEE_EXPENSE', 'OTHER');
  ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE "public"."enum_transactions_type" USING "type"::"public"."enum_transactions_type";`)
}
