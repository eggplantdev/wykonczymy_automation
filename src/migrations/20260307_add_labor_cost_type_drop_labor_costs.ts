import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_transactions_type" RENAME TO "enum_transactions_type_old";
    CREATE TYPE "enum_transactions_type" AS ENUM('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'INVESTMENT_EXPENSE', 'ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE', 'LABOR_COST', 'REGISTER_TRANSFER', 'PAYOUT', 'OTHER', 'CANCELLATION');
    ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "enum_transactions_type" USING "type"::text::"enum_transactions_type";
    DROP TYPE "enum_transactions_type_old";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "labor_costs";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN "labor_costs" numeric DEFAULT 0;
    ALTER TYPE "enum_transactions_type" RENAME TO "enum_transactions_type_old";
    CREATE TYPE "enum_transactions_type" AS ENUM('INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'INVESTMENT_EXPENSE', 'ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE', 'REGISTER_TRANSFER', 'PAYOUT', 'OTHER', 'CANCELLATION');
    ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "enum_transactions_type" USING "type"::text::"enum_transactions_type";
    DROP TYPE "enum_transactions_type_old";
  `)
}
