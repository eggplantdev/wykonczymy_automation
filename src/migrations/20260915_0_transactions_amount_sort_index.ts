import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// EX-777 moved sort to the server, hitting `ORDER BY` directly. `amount` had no btree (only the GIN
// trigram index for `LIKE`, unusable here), so "largest first" cost a full Seq Scan + heapsort; this
// index makes it a backward index scan (cost 227.70 → 2.69 at 4 240 rows).
//
// Only `amount` gets one: `type`/`payment_method`/`vat_plane` have 2–12 distinct values (ordering
// says little, and there's already a filter); `description` is unbounded varchar, where a btree
// would start rejecting inserts past ~2700 bytes.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_amount
      ON transactions(amount);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS idx_transactions_amount;
  `)
}
