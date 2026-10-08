'use client'

import { useState } from 'react'
import { fetchCatalogueItemTemplates } from '@/lib/queries/catalogue-template-usage'
import { settleAction } from '@/lib/utils/settle-action'

// Loaded on the click that opens the dialog, not on mount: /katalog-prac renders a row per praca and
// only the one being edited or deleted needs its szablony. A failed read leaves the list empty —
// the warning is information, never a gate on the edit.
export function useCatalogueItemTemplates(catalogueItemId: number) {
  const [templateNames, setTemplateNames] = useState<string[]>([])

  function loadTemplateNames() {
    void settleAction(() => fetchCatalogueItemTemplates(catalogueItemId)).then((res) =>
      setTemplateNames(res.success ? res.data : []),
    )
  }

  return { templateNames, loadTemplateNames }
}
