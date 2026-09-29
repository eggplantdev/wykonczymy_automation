import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A szablon becomes an investment with status `szablon`, its kosztorys tree being the szablon's
// content — instead of a jsonb row in `kosztorys_presets` edited on ONE shared workshop investment
// that a pointer (`investments.template_preset_id`) switched between szablony. Every bug of that
// design came from the workshop id changing meaning over time (EX-893).
//
// Purely ADDITIVE: the workshop, `kosztorys_presets` and both `template_preset_id` columns stay, so
// the code still live when this runs keeps working; 20260929_2 drops them once the new deploy is live.
//
// Self-contained on purpose — the tree insert is re-stated here rather than imported from
// `lib/kosztorys` (`server-only`, and a historical migration must not change with live code).
//
// Snapshots: the workshop's restore points carry the szablon they were taken for, so each follows
// its szablon to the new investment. The unattributed ones are all „Przed wczytaniem" taken while
// the workshop switched szablony — their content matches no single szablon, so they are deleted
// (owner, 2026-09-29). `down` cannot bring those back.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const workshop = await db.execute(sql`
    SELECT id FROM investments WHERE status = 'szablon' ORDER BY id LIMIT 1;
  `)
  const workshopId = workshop.rows[0] ? Number(workshop.rows[0].id) : null

  await db.execute(sql`DROP INDEX IF EXISTS "investments_single_szablon_idx";`)
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "content_edited_at" timestamptz;
  `)

  const presets = await db.execute(sql`SELECT id FROM kosztorys_presets ORDER BY id;`)

  for (const row of presets.rows) {
    const presetId = Number(row.id)

    // Settings fall back to the column defaults: a preset saved before a setting existed has no key.
    const inserted = await db.execute(sql`
      INSERT INTO investments
        (name, status, vat_rate, w_tools_coeff, own_tools_coeff, created_at, updated_at, content_edited_at)
      SELECT
        p.name,
        'szablon',
        COALESCE((p.payload -> 'settings' ->> 'vatRate')::numeric, 0.08),
        COALESCE((p.payload -> 'settings' ->> 'wToolsCoeff')::numeric, 0.65),
        COALESCE((p.payload -> 'settings' ->> 'ownToolsCoeff')::numeric, 0.5525),
        p.created_at,
        now(),
        p.updated_at
      FROM kosztorys_presets p
      WHERE p.id = ${presetId}
      RETURNING id;
    `)
    const investmentId = Number(inserted.rows[0].id)

    const sections = await db.execute(sql`
      SELECT (s ->> 'id')::int AS old_id, s ->> 'name' AS name,
             COALESCE((s ->> 'displayOrder')::int, 0) AS display_order, s ->> 'color' AS color
      FROM kosztorys_presets p, jsonb_array_elements(p.payload -> 'sections') AS s
      WHERE p.id = ${presetId};
    `)

    const sectionIdMap: Record<string, number> = {}
    for (const s of sections.rows) {
      const created = await db.execute(sql`
        INSERT INTO kosztorys_sections (investment_id, name, display_order, color)
        VALUES (${investmentId}, ${s.name as string}, ${Number(s.display_order)}, ${s.color as string | null})
        RETURNING id;
      `)
      sectionIdMap[String(s.old_id)] = Number(created.rows[0].id)
    }

    // An item whose section is not in the payload is skipped, as insertKosztorysTree does.
    await db.execute(sql`
      INSERT INTO kosztorys_items
        (investment_id, section_id, display_order, description, unit, planned_qty, sheet_measured_qty,
         discount_type, discount_value, client_price, w_tools_override_value, own_tools_override_value,
         w_tools_override_coeff, own_tools_override_coeff, note)
      SELECT
        ${investmentId},
        (${JSON.stringify(sectionIdMap)}::jsonb ->> (i ->> 'sectionId'))::int,
        COALESCE((i ->> 'displayOrder')::int, 0),
        i ->> 'description',
        i ->> 'unit',
        COALESCE((i ->> 'plannedQty')::numeric, 0),
        (i ->> 'sheetMeasuredQty')::numeric,
        i ->> 'discountType',
        COALESCE((i ->> 'discountValue')::numeric, 0),
        COALESCE((i ->> 'clientPrice')::numeric, 0),
        (i ->> 'wToolsOverrideValue')::numeric,
        (i ->> 'ownToolsOverrideValue')::numeric,
        (i ->> 'wToolsOverrideCoeff')::numeric,
        (i ->> 'ownToolsOverrideCoeff')::numeric,
        i ->> 'note'
      FROM kosztorys_presets p, jsonb_array_elements(p.payload -> 'items') AS i
      WHERE p.id = ${presetId}
        AND ${JSON.stringify(sectionIdMap)}::jsonb ? (i ->> 'sectionId');
    `)

    if (workshopId != null) {
      await db.execute(sql`
        UPDATE kosztorys_snapshots SET investment_id = ${investmentId}
        WHERE investment_id = ${workshopId} AND template_preset_id = ${presetId};
      `)
    }
  }

  if (workshopId != null) {
    await db.execute(sql`
      DELETE FROM kosztorys_snapshots
      WHERE investment_id = ${workshopId} AND template_preset_id IS NULL;
    `)
  }

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "investments_szablon_name_idx"
      ON "investments" (lower(trim(name))) WHERE status = 'szablon';
  `)
}

// The workshop is the oldest szablon — every szablon `up` created has a higher id. Moved restore
// points go back to it (they still carry template_preset_id) before the cascade would take them.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "investments_szablon_name_idx";

    WITH workshop AS (SELECT min(id) AS id FROM investments WHERE status = 'szablon')
    UPDATE kosztorys_snapshots SET investment_id = (SELECT id FROM workshop)
    WHERE template_preset_id IS NOT NULL
      AND investment_id IN (
        SELECT id FROM investments WHERE status = 'szablon' AND id > (SELECT id FROM workshop)
      );

    DELETE FROM investments
    WHERE status = 'szablon'
      AND id > (SELECT min(id) FROM investments WHERE status = 'szablon');

    ALTER TABLE "investments" DROP COLUMN IF EXISTS "content_edited_at";

    CREATE UNIQUE INDEX IF NOT EXISTS "investments_single_szablon_idx"
      ON "investments" (status) WHERE status = 'szablon';
  `)
}
