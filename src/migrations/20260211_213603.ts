import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactions_type" AS ENUM('INVESTMENT_EXPENSE', 'ADVANCE', 'EMPLOYEE_EXPENSE', 'OTHER');
  CREATE TYPE "public"."enum_transactions_payment_method" AS ENUM('CASH', 'BLIK', 'TRANSFER', 'CARD');
  CREATE TABLE "transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"type" "enum_transactions_type" NOT NULL,
  	"payment_method" "enum_transactions_payment_method" NOT NULL,
  	"cash_register_id" integer NOT NULL,
  	"investment_id" integer,
  	"worker_id" integer,
  	"other_category_id" integer,
  	"other_description" varchar,
  	"invoice_id" integer,
  	"invoice_note" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transactions_id" integer;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_other_category_id_other_categories_id_fk" FOREIGN KEY ("other_category_id") REFERENCES "public"."other_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_media_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "transactions_cash_register_idx" ON "transactions" USING btree ("cash_register_id");
  CREATE INDEX "transactions_investment_idx" ON "transactions" USING btree ("investment_id");
  CREATE INDEX "transactions_worker_idx" ON "transactions" USING btree ("worker_id");
  CREATE INDEX "transactions_other_category_idx" ON "transactions" USING btree ("other_category_id");
  CREATE INDEX "transactions_invoice_idx" ON "transactions" USING btree ("invoice_id");
  CREATE INDEX "transactions_created_by_idx" ON "transactions" USING btree ("created_by_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "transactions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  DROP INDEX "payload_locked_documents_rels_transactions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transactions_id";
  DROP TYPE "public"."enum_transactions_type";
  DROP TYPE "public"."enum_transactions_payment_method";`)
}
