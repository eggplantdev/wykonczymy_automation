import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Nullable with no default: null is „Uzupełnianie informacji”, the state of every existing investment.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_investments_ai_stage" AS ENUM('ready_for_analysis', 'analyzed', 'review_done', 'knowledge_extracted');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "investments"
    ADD COLUMN IF NOT EXISTS "ai_stage" "enum_investments_ai_stage";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
    DROP COLUMN IF EXISTS "ai_stage";

    DROP TYPE IF EXISTS "public"."enum_investments_ai_stage";
  `)
}
