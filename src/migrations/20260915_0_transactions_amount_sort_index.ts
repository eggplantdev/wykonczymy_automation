import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// EX-777 moved the transfers table's sort to the server, so a sort key the user picks now reaches
// `ORDER BY` instead of being applied to the loaded page. `amount` had no btree — only the GIN
// trigram index backing the `LIKE` amount search, which `ORDER BY` cannot use — so every page of
// „largest first" cost a full Seq Scan + top-N heapsort before the LIMIT. With the index the plan
// becomes a backward index scan that stops at the page (cost 227.70 → 2.69 at 4 240 rows).
//
// Only `amount` is indexed. The other unindexed sortable columns are 2–12 distinct values
// (`type`, `payment_method`, `vat_plane`), where ordering says almost nothing and the table already
// offers a filter; `description` is unbounded varchar, and a btree over it would start rejecting
// inserts once a description passes ~2700 bytes.
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
