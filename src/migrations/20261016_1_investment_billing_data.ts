import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_investments_billing_client_type" AS ENUM('person', 'company');
    ALTER TABLE "investments"
      ADD COLUMN "postal_code" varchar,
      ADD COLUMN "city" varchar,
      ADD COLUMN "country" varchar,
      ADD COLUMN "billing_client_type" "enum_investments_billing_client_type",
      ADD COLUMN "billing_first_name" varchar,
      ADD COLUMN "billing_last_name" varchar,
      ADD COLUMN "billing_company_name" varchar,
      ADD COLUMN "billing_nip" varchar,
      ADD COLUMN "billing_representative" varchar,
      ADD COLUMN "billing_same_as_site" boolean DEFAULT true,
      ADD COLUMN "billing_street" varchar,
      ADD COLUMN "billing_postal_code" varchar,
      ADD COLUMN "billing_city" varchar,
      ADD COLUMN "billing_country" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
      DROP COLUMN "postal_code",
      DROP COLUMN "city",
      DROP COLUMN "country",
      DROP COLUMN "billing_client_type",
      DROP COLUMN "billing_first_name",
      DROP COLUMN "billing_last_name",
      DROP COLUMN "billing_company_name",
      DROP COLUMN "billing_nip",
      DROP COLUMN "billing_representative",
      DROP COLUMN "billing_same_as_site",
      DROP COLUMN "billing_street",
      DROP COLUMN "billing_postal_code",
      DROP COLUMN "billing_city",
      DROP COLUMN "billing_country";
    DROP TYPE "public"."enum_investments_billing_client_type";
  `)
}
