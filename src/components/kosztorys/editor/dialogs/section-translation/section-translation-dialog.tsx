'use client'

import { useState } from 'react'
import { useLoadOnOpen } from '@/components/kosztorys/editor/hooks/use-load-on-open'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { LanguageLabel } from '@/components/ui/language-label'
import { Label } from '@/components/ui/label'
import { useDraft } from '@/hooks/use-draft'
import { saveSectionTranslationsAction } from '@/lib/actions/section-translations'
import { TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import { getSectionTranslationForName } from '@/lib/queries/section-translations-endpoint'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać tłumaczenia sekcji'

export function SectionTranslationDialog({
  sectionName,
  open,
  onOpenChange,
}: {
  sectionName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const loaded = useLoadOnOpen(
    getSectionTranslationForName,
    sectionName,
    open,
    onOpenChange,
    LOAD_FAILED,
  )
  const [draft, setDraft] = useDraft(loaded)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!draft || saving) return
    setSaving(true)
    const res = await settleAction(() => saveSectionTranslationsAction(sectionName, draft))
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error, 'error', 4000)
      return
    }
    toastMessage('Zapisano tłumaczenie sekcji', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Tłumaczenie sekcji"
      description="Tłumaczenie jest wspólne dla każdej rozpiski z sekcją o tej nazwie i pracownik widzi je w linku do zgłoszenia prac; liczby z nazwy podstawiają się dla każdej sekcji osobno."
      confirmLabel="Zapisz"
      onConfirm={() => void handleSave()}
      confirmDisabled={!draft || saving}
    >
      <p className="text-sm font-medium">{sectionName}</p>
      {!draft ? (
        <Description size="xs">Wczytywanie…</Description>
      ) : (
        TRANSLATION_LANGUAGES.map((language) => (
          <Label key={language} className="flex-col items-stretch gap-1 text-xs font-normal">
            <LanguageLabel language={language} />
            <Input
              value={draft[language]}
              onChange={(e) => {
                const value = e.target.value
                setDraft((prev) => prev && { ...prev, [language]: value })
              }}
            />
          </Label>
        ))
      )}
    </FormDialogShell>
  )
}
