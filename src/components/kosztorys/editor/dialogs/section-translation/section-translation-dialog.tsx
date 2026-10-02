'use client'

import { useState } from 'react'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveSectionTranslationsAction } from '@/lib/actions/section-translations'
import {
  LANGUAGE_LABELS,
  TRANSLATION_LANGUAGES,
  type TranslationLanguageT,
} from '@/lib/i18n/languages'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useSectionTranslationOnOpen } from './use-section-translation-on-open'

export function SectionTranslationDialog({
  sectionName,
  open,
  onOpenChange,
}: {
  sectionName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const loaded = useSectionTranslationOnOpen(sectionName, open, onOpenChange)
  // Edits sit over the loaded values, so the fields fill the moment the read lands without an
  // effect copying it into state.
  const [edits, setEdits] = useState<Partial<Record<TranslationLanguageT, string>>>({})
  const [saving, setSaving] = useState(false)

  const valueOf = (language: TranslationLanguageT) => edits[language] ?? loaded?.[language] ?? ''

  async function handleSave() {
    if (!loaded || saving) return
    setSaving(true)
    const typed = Object.fromEntries(
      TRANSLATION_LANGUAGES.map((language) => [language, valueOf(language)]),
    ) as Record<TranslationLanguageT, string>
    const res = await settleAction(() => saveSectionTranslationsAction(sectionName, typed))
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
      confirmDisabled={!loaded || saving}
    >
      <p className="text-sm font-medium">{sectionName}</p>
      {!loaded ? (
        <Description size="xs">Wczytywanie…</Description>
      ) : (
        TRANSLATION_LANGUAGES.map((language) => (
          <Label key={language} className="flex-col items-stretch gap-1 text-xs font-normal">
            {LANGUAGE_LABELS[language]}
            <Input
              value={valueOf(language)}
              onChange={(e) => setEdits((prev) => ({ ...prev, [language]: e.target.value }))}
            />
          </Label>
        ))
      )}
    </FormDialogShell>
  )
}
