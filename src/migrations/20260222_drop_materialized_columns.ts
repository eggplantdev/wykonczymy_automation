import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" DROP COLUMN IF EXISTS "balance";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "total_costs";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "total_income";
    ALTER TYPE "enum_transactions_type" RENAME TO "enum_transactions_type_old";
    CREATE TYPE "enum_transactions_type" AS ENUM('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'INVESTMENT_EXPENSE', 'ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE', 'REGISTER_TRANSFER', 'PAYOUT', 'OTHER', 'CANCELLATION');
    ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "enum_transactions_type" USING "type"::text::"enum_transactions_type";
    DROP TYPE "enum_transactions_type_old";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cash_registers" ADD COLUMN "balance" numeric DEFAULT 0;
    ALTER TABLE "investments" ADD COLUMN "total_costs" numeric DEFAULT 0;
    ALTER TABLE "investments" ADD COLUMN "total_income" numeric DEFAULT 0;
  `)
}
