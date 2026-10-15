import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A szablon gets its own tables instead of an `investments` row with `status = 'szablon'` whose
// prace sit in `kosztorys_items` carrying a dead copy of the katalog entry (EX-1075). A szablon praca
// is a katalog FK + section + order, so the schema cannot hold a copy or an unlinked praca.
//
// Purely ADDITIVE: the szablon investments stay, so the code live when this runs keeps working; a
// later migration deletes them once the deploy that stops reading them is live. Prod migrates
// BEFORE the push. A szablon edit made between this copy and the deploy is lost (owner, accepted).
//
// Copies every NON-trashed szablon investment. The trashed one has no linked prace and dies with
// the old rows (owner, 2026-10-15). An item with no katalog link, or a link to a deleted katalog
// entry, is dropped — the FK would refuse it, and the app already rendered such a praca from a copy
// nobody maintained. Its versions are converted to refs (katalog ids per section, in order).
//
// Self-contained on purpose — a historical migration must not change with live code.
type StoredSectionT = { id?: number; name?: string; displayOrder?: number; color?: string | null }
type StoredItemT = { sectionId?: number; displayOrder?: number; catalogueItemId?: number | null }

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "trashed_at" timestamp(3) with time zone,
      "content_edited_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "templates_name_idx" ON "templates" (lower(trim(name)));
    CREATE INDEX IF NOT EXISTS "templates_updated_at_idx" ON "templates" ("updated_at");
    CREATE INDEX IF NOT EXISTS "templates_created_at_idx" ON "templates" ("created_at");

    CREATE TABLE IF NOT EXISTS "template_sections" (
      "id" serial PRIMARY KEY NOT NULL,
      "template_id" integer NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "display_order" integer NOT NULL DEFAULT 0,
      "color" varchar,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "template_sections_template_order_idx"
      ON "template_sections" ("template_id", "display_order");
    CREATE INDEX IF NOT EXISTS "template_sections_updated_at_idx" ON "template_sections" ("updated_at");
    CREATE INDEX IF NOT EXISTS "template_sections_created_at_idx" ON "template_sections" ("created_at");

    CREATE TABLE IF NOT EXISTS "template_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "section_id" integer NOT NULL REFERENCES "template_sections"("id") ON DELETE CASCADE,
      "catalogue_item_id" integer NOT NULL REFERENCES "work_catalogue_items"("id") ON DELETE CASCADE,
      "display_order" integer NOT NULL DEFAULT 0,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "template_items_section_order_idx"
      ON "template_items" ("section_id", "display_order");
    CREATE INDEX IF NOT EXISTS "template_items_catalogue_item_idx"
      ON "template_items" ("catalogue_item_id");
    CREATE INDEX IF NOT EXISTS "template_items_updated_at_idx" ON "template_items" ("updated_at");
    CREATE INDEX IF NOT EXISTS "template_items_created_at_idx" ON "template_items" ("created_at");

    -- Raw, like kosztorys_snapshots: no collection, so no locked-docs column.
    CREATE TABLE IF NOT EXISTS "template_snapshots" (
      "id" serial PRIMARY KEY NOT NULL,
      "template_id" integer NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
      "taken_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "taken_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "kind" varchar NOT NULL,
      "label" varchar,
      "schema_version" integer NOT NULL,
      "payload" jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "template_snapshots_template_taken_idx"
      ON "template_snapshots" ("template_id", "taken_at" DESC);
    CREATE INDEX IF NOT EXISTS "template_snapshots_template_kind_taken_idx"
      ON "template_snapshots" ("template_id", "kind", "taken_at");

    -- Payload's lock-check SELECT names a column per collection and throws without it (20260709_1).
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "templates_id" integer
      REFERENCES "templates"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_templates_id_idx"
      ON "payload_locked_documents_rels" ("templates_id");
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "template_sections_id" integer
      REFERENCES "template_sections"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_template_sections_id_idx"
      ON "payload_locked_documents_rels" ("template_sections_id");
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "template_items_id" integer
      REFERENCES "template_items"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_template_items_id_idx"
      ON "payload_locked_documents_rels" ("template_items_id");
  `)

  const sources = await db.execute(sql`
    SELECT id, name, created_at, content_edited_at FROM investments
    WHERE status = 'szablon' AND trashed_at IS NULL
    ORDER BY id;
  `)

  const catalogue = await db.execute(sql`SELECT id FROM work_catalogue_items;`)
  const liveCatalogueIds = new Set(catalogue.rows.map((row) => Number(row.id)))

  for (const source of sources.rows) {
    const investmentId = Number(source.id)

    const inserted = await db.execute(sql`
      INSERT INTO templates (name, content_edited_at, created_at)
      VALUES (${source.name as string}, ${source.content_edited_at as string | null},
              ${source.created_at as string})
      RETURNING id;
    `)
    const templateId = Number(inserted.rows[0].id)

    const sections = await db.execute(sql`
      SELECT id, name, display_order, color FROM kosztorys_sections
      WHERE investment_id = ${investmentId}
      ORDER BY display_order, id;
    `)
    for (const section of sections.rows) {
      const created = await db.execute(sql`
        INSERT INTO template_sections (template_id, name, display_order, color)
        VALUES (${templateId}, ${section.name as string}, ${Number(section.display_order)},
                ${section.color as string | null})
        RETURNING id;
      `)
      await db.execute(sql`
        INSERT INTO template_items (section_id, catalogue_item_id, display_order)
        SELECT ${Number(created.rows[0].id)}, i.catalogue_item_id, i.display_order
        FROM kosztorys_items i
        JOIN work_catalogue_items c ON c.id = i.catalogue_item_id
        WHERE i.section_id = ${Number(section.id)}
        ORDER BY i.display_order, i.id;
      `)
    }

    const snapshots = await db.execute(sql`
      SELECT taken_at, taken_by, kind, label, payload FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
      ORDER BY taken_at, id;
    `)
    for (const snapshot of snapshots.rows) {
      const stored = snapshot.payload as { sections?: StoredSectionT[]; items?: StoredItemT[] }
      const storedItems = stored.items ?? []
      const converted = {
        sections: [...(stored.sections ?? [])]
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map((section) => ({
            name: section.name ?? '',
            color: section.color ?? null,
            catalogueItemIds: storedItems
              .filter((item) => item.sectionId === section.id)
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              .map((item) => item.catalogueItemId)
              .filter((id): id is number => id != null && liveCatalogueIds.has(Number(id)))
              .map(Number),
          })),
      }
      await db.execute(sql`
        INSERT INTO template_snapshots (template_id, taken_at, taken_by, kind, label, schema_version, payload)
        VALUES (${templateId}, ${snapshot.taken_at as string}, ${snapshot.taken_by as number | null},
                ${snapshot.kind as string}, ${snapshot.label as string | null}, 1,
                ${JSON.stringify(converted)}::jsonb);
      `)
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_template_items_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "template_items_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_template_sections_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "template_sections_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_templates_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "templates_id";
    DROP TABLE IF EXISTS "template_snapshots";
    DROP TABLE IF EXISTS "template_items";
    DROP TABLE IF EXISTS "template_sections";
    DROP TABLE IF EXISTS "templates";
  `)
}
