import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "default_cash_register_id" integer;
  ALTER TABLE "users" ADD CONSTRAINT "users_default_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("default_cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_default_cash_register_idx" ON "users" USING btree ("default_cash_register_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT "users_default_cash_register_id_cash_registers_id_fk";
  
  DROP INDEX "users_default_cash_register_idx";
  ALTER TABLE "users" DROP COLUMN "default_cash_register_id";`)
}
