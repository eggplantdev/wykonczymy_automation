import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create expense_categories table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "expense_categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_name_idx" ON "expense_categories" ("name");
    CREATE INDEX IF NOT EXISTS "expense_categories_updated_at_idx" ON "expense_categories" ("updated_at");
    CREATE INDEX IF NOT EXISTS "expense_categories_created_at_idx" ON "expense_categories" ("created_at");
  `)

  // 2. Seed initial categories
  await db.execute(sql`
    INSERT INTO expense_categories (name, updated_at, created_at)
    VALUES ('Materiały budowlane', NOW(), NOW()),
           ('Materiały wykończeniowe', NOW(), NOW())
    ON CONFLICT (name) DO NOTHING;
  `)

  // 3. Add expense_category_id column to transactions
  await db.execute(sql`
    ALTER TABLE "transactions"
    ADD COLUMN "expense_category_id" integer
    REFERENCES "expense_categories"("id") ON DELETE SET NULL;

    CREATE INDEX "transactions_expense_category_idx"
    ON "transactions" ("expense_category_id");
  `)

  // 4. Backfill existing INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE (with investment) rows
  await db.execute(sql`
    UPDATE transactions
    SET expense_category_id = (SELECT id FROM expense_categories WHERE name = 'Materiały budowlane')
    WHERE type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
      AND investment_id IS NOT NULL
      AND expense_category_id IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "expense_category_id";
    DROP TABLE IF EXISTS "expense_categories";
  `)
}
