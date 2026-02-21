import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "finance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"default_cash_register_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_default_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("default_cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "finance_settings_default_cash_register_idx" ON "finance_settings" USING btree ("default_cash_register_id");
  ALTER TABLE "cash_registers" DROP COLUMN "is_default";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "finance_settings" CASCADE;
  ALTER TABLE "cash_registers" ADD COLUMN "is_default" boolean DEFAULT false;`)
}
