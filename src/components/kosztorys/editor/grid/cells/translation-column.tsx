'use client'

import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { LongTextCell } from '@/components/ui/datasheet-grid/long-text-cell'
import { translationText } from '@/lib/i18n/description-translations'
import type { TranslationLanguageT } from '@/lib/i18n/languages'
import { withRowTranslation } from '@/lib/kosztorys/row-translation'
import { translationColumnKey } from '@/lib/kosztorys/translation-column-keys'
import { wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// An object, never the bare language: `withSyntheticRows` spreads `columnData`, which turns a string
// into an object.
type TranslationCellDataT = { language: TranslationLanguageT }

function TranslationCell({
  rowData,
  setRowData,
  focus,
  disabled,
  stopEditing,
  columnData: { language },
}: CellProps<KosztorysV2RowT, TranslationCellDataT>) {
  return (
    <LongTextCell
      value={translationText(rowData.descriptionTranslations, language) || null}
      focus={focus}
      disabled={disabled}
      onCommit={(text) => setRowData(withRowTranslation(rowData, language, text))}
      stopEditing={stopEditing}
    />
  )
}

export function translationColumn(
  language: TranslationLanguageT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT, TranslationCellDataT> {
  const id = translationColumnKey(language)
  return {
    id,
    title: titleNode,
    columnData: { language },
    component: TranslationCell,
    minWidth: 360,
    grow: 2,
    // Same overlay contract as „Opis prac": the textarea owns Enter and the arrows while editing.
    disableKeys: true,
    headerClassName: wrapColumnClass(id),
    cellClassName: wrapColumnClass(id),
    copyValue: ({ rowData }) => translationText(rowData.descriptionTranslations, language),
    deleteValue: ({ rowData }) => withRowTranslation(rowData, language, null),
    pasteValue: ({ rowData, value }) => withRowTranslation(rowData, language, value),
    isCellEmpty: ({ rowData }) => translationText(rowData.descriptionTranslations, language) === '',
  }
}
