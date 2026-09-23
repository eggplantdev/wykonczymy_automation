import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// EX-865: a subcontractor stawka gets a THIRD source — „własny mnożnik", a per-praca coefficient
// against the client price, so raising „Cena j.m." raises the crew's rate with it. That is the one
// thing a frozen kwota cannot do, and the reason the owner asked for it back.
//
// This is NOT the reverse of EX-766 (20260902_0). That one collapsed a discriminator column whose
// only live value was 'amount' — a one-member union. Here the companion column carries a NUMBER, so
// it is the value AND the discriminator at once: non-null means „this praca's rate is a multiplier",
// and there is no state where the pair disagrees about which kind it is. What EX-766 actually paid
// for was the WRITE PATH — the grid saves one field per action call, so two columns over one concept
// persisted as two unordered writes. That is fixed above this migration, in `updateItemFieldAction`,
// which expands a write touching either column into a write of both.
//
// Precedence, in one sentence so the SQL readers can be checked against it: coeff > kwota > the
// investment's global współczynnik.
//
// The catalogue columns are `*_rate_coeff`, not `*_coeff`: `investments.w_tools_coeff` is the GLOBAL
// investment multiplier, and two different concepts must not read alike in a dump.
//
// Additive — no NOT NULL, no DEFAULT, no backfill. Every existing kwota stała stays a kwota stała;
// nobody guesses backwards which of them „meant" to be a multiplier. So this goes to production
// BEFORE the code that reads it ships.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN "w_tools_override_coeff" numeric,
      ADD COLUMN "own_tools_override_coeff" numeric;

    ALTER TABLE "work_catalogue_items"
      ADD COLUMN "w_tools_rate_coeff" numeric,
      ADD COLUMN "own_tools_rate_coeff" numeric;
  `)
}

// Loses only the multipliers typed after the deploy — a row reverts to „auto", which is what it was
// before someone chose a multiplier for it. Kwoty stałe and „auto" live in columns this change never
// touches, so they come through untouched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      DROP COLUMN "w_tools_override_coeff",
      DROP COLUMN "own_tools_override_coeff";

    ALTER TABLE "work_catalogue_items"
      DROP COLUMN "w_tools_rate_coeff",
      DROP COLUMN "own_tools_rate_coeff";
  `)
}
