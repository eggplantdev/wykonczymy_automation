'use client'

import { applyCatalogueToKosztorysAction } from '@/lib/actions/catalogue-to-kosztorys'
import { mergeTranslations } from '@/lib/i18n/description-translations'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import type { EditorRowsT } from '@/components/kosztorys/editor/hooks/use-editor-rows'
import type { CatalogueNameT, SeedConflictFieldT } from '@/lib/kosztorys/work-catalogue/types'

type ArgsT = {
  investmentId: number
  editorRows: Pick<EditorRowsT, 'rowsRef' | 'patchRows'>
  actions: EditorActionsT
}

export function useCatalogueOps({ investmentId, editorRows, actions }: ArgsT) {
  const { rowsRef, patchRows } = editorRows

  async function handleApplyCatalogueToItems(
    selections: { itemId: number; fields: SeedConflictFieldT[] }[],
  ): Promise<boolean> {
    const res = await settleAction(() => applyCatalogueToKosztorysAction(investmentId, selections))
    if (!res.success) {
      toastMessage(res.error, 'warning', 4000)
      return false
    }
    const patchById = new Map(res.data.map(({ itemId, ...values }) => [itemId, values] as const))
    patchRows(
      (r) => patchById.has(r.id),
      (r) => ({ ...r, ...patchById.get(r.id) }),
    )
    return true
  }

  /**
   * Both or neither — the klucz is the pair, so writing the nazwa alone moves the praca from one
   * „brak w katalogu" to another and the gesture looks like it did nothing.
   */
  async function handleAcceptCatalogueName(itemId: number, name: CatalogueNameT): Promise<boolean> {
    const before = rowsRef.current.find((r) => r.id === itemId)
    const patch = {
      ...name,
      descriptionTranslations: mergeTranslations(
        before?.descriptionTranslations,
        name.descriptionTranslations,
        name.description,
      ),
    }
    patchRows(
      (r) => r.id === itemId,
      (r) => ({ ...r, ...patch }),
    )
    const res = await settleAction(() => actions.updateItemField(itemId, patch))
    if (!res.success) {
      if (before)
        patchRows(
          (r) => r.id === itemId,
          (r) => ({
            ...r,
            description: before.description,
            unit: before.unit,
            descriptionTranslations: before.descriptionTranslations,
          }),
        )
      toastMessage(res.error, 'warning', 4000)
      return false
    }
    return true
  }

  return { handleApplyCatalogueToItems, handleAcceptCatalogueName }
}
