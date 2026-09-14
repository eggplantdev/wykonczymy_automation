'use client'

import { useTransition } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveWorkshopPresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// The szablon workbench's „Zapisz": the target is already known (it is the szablon that was opened),
// so there is no name to ask for and no mode to pick — the dialog's two questions both have one
// answer here. „Zapisz jako szablon…" stays in the menu for forking a copy under a new name.
export function SaveTemplateButton() {
  const { templatePresetId } = useKosztorysEditorContext()
  const [pending, startTransition] = useTransition()

  if (templatePresetId == null) return null

  const onSave = () => {
    startTransition(async () => {
      const res = await saveWorkshopPresetAction(templatePresetId)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się zapisać szablonu', 'error')
      toastMessage('Zapisano szablon', 'success')
    })
  }

  return (
    <Button size="sm" onClick={onSave} disabled={pending}>
      <Save />
      {pending ? 'Zapisuję…' : 'Zapisz szablon'}
    </Button>
  )
}
