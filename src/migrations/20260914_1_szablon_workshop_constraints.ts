import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Separate from 20260914_0 on purpose: that one is already applied, so amending it would leave
// every database that has run it without these two constraints.
//
// Both statements move a rule out of application code, where it was only a convention, into the
// schema, where it is enforced:
//
// 1. The warsztat is a SINGLETON. `resolveWorkshopInvestment` looks for one and creates it when
//    absent, which is a SELECT-then-INSERT — two „Otwórz" clicks racing the very first provisioning
//    both see nothing and both insert. `getWorkshop` then takes `ORDER BY id LIMIT 1`, so the
//    second warsztat becomes an invisible orphan that silently swallows whatever was edited in it.
//    A partial unique index makes the second INSERT fail instead.
// 2. `template_preset_id` is a POINTER into kosztorys_presets, and nothing stopped it from
//    outliving its target — deleting a szablon left the warsztat claiming a row that no longer
//    exists, which the page then renders as somebody else's content under a missing name.
//    ON DELETE SET NULL turns that into the „nic nie jest otwarte" state the UI already handles.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "investments_single_szablon_idx"
      ON "investments" ("status") WHERE "status" = 'szablon';

    ALTER TABLE "investments"
      ADD CONSTRAINT "investments_template_preset_id_fk"
      FOREIGN KEY ("template_preset_id") REFERENCES "kosztorys_presets"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_template_preset_id_fk";
    DROP INDEX IF EXISTS "investments_single_szablon_idx";
  `)
}
