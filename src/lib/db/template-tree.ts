import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import { toDescriptionTranslations } from '@/lib/i18n/description-translations'
import { mapSection, type KosztorysTreeDataT } from './kosztorys-tree'
import type { DbExecutorT } from './get-db'
import { numOrNull } from './row-coerce'

type RowT = Record<string, unknown>

// Coefficients, VAT and settlement are left unset so the tree builder fills the defaults.
export async function selectTemplateTreeData(
  db: DbExecutorT,
  templateId: number,
): Promise<KosztorysTreeDataT | null> {
  const res = await db.execute(sql`
    SELECT
      (
        SELECT coalesce(json_agg(s ORDER BY s.display_order, s.id), '[]'::json)
        FROM (
          SELECT id, name, display_order, color
          FROM template_sections WHERE template_id = ${templateId}
        ) s
      ) AS sections,
      (
        SELECT coalesce(json_agg(i ORDER BY i.section_order, i.section_id, i.display_order, i.id), '[]'::json)
        FROM (
          SELECT ti.id, ti.section_id, ti.display_order, ts.display_order AS section_order,
                 w.id AS catalogue_item_id, w.description, w.description_translations, w.unit,
                 w.client_price, w.w_tools_rate, w.w_tools_rate_coeff,
                 w.own_tools_rate, w.own_tools_rate_coeff
          FROM template_items ti
          JOIN template_sections ts ON ts.id = ti.section_id
          JOIN work_catalogue_items w ON w.id = ti.catalogue_item_id
          WHERE ts.template_id = ${templateId}
        ) i
      ) AS items,
      t.updated_at
    FROM templates t
    WHERE t.id = ${templateId}
  `)

  const row = res.rows[0]
  if (!row) return null

  return {
    sections: (row.sections as RowT[]).map(mapSection),
    items: (row.items as RowT[]).map(mapTemplateItem),
    stages: [],
    progress: [],
    investment: {
      wToolsCoeff: null,
      ownToolsCoeff: null,
      vatRate: null,
      settlementMode: SETTLEMENT_MODE_DEFAULT,
      materialsNetRate: null,
      globalDiscountType: null,
      globalDiscountValue: 0,
      updatedAt: new Date(row.updated_at as string).toISOString(),
    },
  }
}

const mapTemplateItem = (row: RowT) => ({
  ...itemFromFields(
    {
      description: String(row.description),
      descriptionTranslations: toDescriptionTranslations(row.description_translations),
      unit: String(row.unit),
      clientPrice: Number(row.client_price ?? 0),
      wToolsRate: numOrNull(row.w_tools_rate),
      wToolsRateCoeff: numOrNull(row.w_tools_rate_coeff),
      ownToolsRate: numOrNull(row.own_tools_rate),
      ownToolsRateCoeff: numOrNull(row.own_tools_rate_coeff),
    },
    Number(row.section_id),
    Number(row.display_order ?? 0),
    Number(row.catalogue_item_id),
  ),
  id: Number(row.id),
})
