import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_investments_status" AS ENUM('active', 'completed');
  CREATE TABLE "cash_registers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"balance" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "investments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"address" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"contact_person" varchar,
  	"notes" varchar,
  	"total_costs" numeric DEFAULT 0,
  	"status" "enum_investments_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "other_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cash_registers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "investments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "other_categories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cash_registers_owner_idx" ON "cash_registers" USING btree ("owner_id");
  CREATE INDEX "cash_registers_updated_at_idx" ON "cash_registers" USING btree ("updated_at");
  CREATE INDEX "cash_registers_created_at_idx" ON "cash_registers" USING btree ("created_at");
  CREATE INDEX "investments_updated_at_idx" ON "investments" USING btree ("updated_at");
  CREATE INDEX "investments_created_at_idx" ON "investments" USING btree ("created_at");
  CREATE UNIQUE INDEX "other_categories_name_idx" ON "other_categories" USING btree ("name");
  CREATE INDEX "other_categories_updated_at_idx" ON "other_categories" USING btree ("updated_at");
  CREATE INDEX "other_categories_created_at_idx" ON "other_categories" USING btree ("created_at");
  CREATE INDEX "media_created_by_idx" ON "media" USING btree ("created_by_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cash_registers_fk" FOREIGN KEY ("cash_registers_id") REFERENCES "public"."cash_registers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_investments_fk" FOREIGN KEY ("investments_id") REFERENCES "public"."investments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_other_categories_fk" FOREIGN KEY ("other_categories_id") REFERENCES "public"."other_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cash_registers_id_idx" ON "payload_locked_documents_rels" USING btree ("cash_registers_id");
  CREATE INDEX "payload_locked_documents_rels_investments_id_idx" ON "payload_locked_documents_rels" USING btree ("investments_id");
  CREATE INDEX "payload_locked_documents_rels_other_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("other_categories_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cash_registers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "investments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "other_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cash_registers" CASCADE;
  DROP TABLE "investments" CASCADE;
  DROP TABLE "other_categories" CASCADE;
  DROP TABLE "media" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_cash_registers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_investments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_other_categories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  DROP INDEX "payload_locked_documents_rels_cash_registers_id_idx";
  DROP INDEX "payload_locked_documents_rels_investments_id_idx";
  DROP INDEX "payload_locked_documents_rels_other_categories_id_idx";
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "cash_registers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "investments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "other_categories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  DROP TYPE "public"."enum_investments_status";`)
}
