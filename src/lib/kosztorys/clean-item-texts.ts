import type { ItemTextRowT } from '@/lib/db/kosztorys-item-texts'
import { restampTranslations } from '@/lib/i18n/description-translations'
import { cleanDescription } from '@/lib/kosztorys/clean-description'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'

/**
 * The rows „Popraw literówki" would rewrite. A blank column is left blank rather than cleaned into
 * '', which would count every empty praca as „poprawiona".
 */
export function cleanItemTexts(rows: readonly ItemTextRowT[]): ItemTextRowT[] {
  return rows.flatMap((row) => {
    const description = row.description ? cleanDescription(row.description) : row.description
    const unit = row.unit ? cleanUnit(row.unit) : row.unit
    return description === row.description && unit === row.unit
      ? []
      : [
          {
            id: row.id,
            description,
            unit,
            descriptionTranslations: restampTranslations(
              row.descriptionTranslations,
              row.description,
              description,
            ),
          },
        ]
  })
}
