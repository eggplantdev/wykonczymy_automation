import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS amount_edits (
      id serial PRIMARY KEY,
      transaction_id integer REFERENCES transactions(id) ON DELETE SET NULL,
      previous_amount numeric NOT NULL,
      new_amount numeric NOT NULL,
      edited_by_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_amount_edits_transaction
      ON amount_edits(transaction_id);

    ALTER TABLE payload_locked_documents_rels
    ADD COLUMN IF NOT EXISTS amount_edits_id integer
      REFERENCES amount_edits(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_amount_edits_id_idx
      ON payload_locked_documents_rels(amount_edits_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE payload_locked_documents_rels
    DROP COLUMN IF EXISTS amount_edits_id;

    DROP TABLE IF EXISTS amount_edits;
  `)
}
