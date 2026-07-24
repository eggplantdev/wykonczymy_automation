'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { SimpleSelect } from '@/components/ui/simple-select'
import { savePresetAction } from '@/lib/actions/kosztorys-presets'
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Fetched by the parent when the dialog opens; only the overwrite picker needs it.
  existingPresets: PresetMetaT[]
}

// "Zapisz jako szablon…" — save this kosztorys as a reusable, cross-investment template, itself
// either a new named template or an overwrite of an existing one (name picked from the list).
export function SavePresetDialog({ investmentId, open, onOpenChange, existingPresets }: PropsT) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'new' | 'overwrite'>('new')
  const [overwriteName, setOverwriteName] = useState('')
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (next) return
    setName('')
    setMode('new')
    setOverwriteName('')
  }

  const targetName = mode === 'new' ? name.trim() : overwriteName
  const canSave = targetName.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res = await savePresetAction(investmentId, targetName, mode)
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać szablonu', 'error', 4000)
      return
    }
    toastMessage('Zapisano szablon', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Zapisz jako szablon…"
      description="Szablon — wzór kosztorysu wielokrotnego użytku, niezależny od tej inwestycji. Posłuży do szybkiego założenia kosztorysu na innych inwestycjach."
      confirmLabel="Zapisz"
      onConfirm={() => void handleSave()}
      confirmDisabled={!canSave}
    >
      {existingPresets.length > 0 && (
        <ToggleGroup
          options={[
            { value: 'new', label: 'Nowy' },
            { value: 'overwrite', label: 'Nadpisz istniejący' },
          ]}
          value={mode}
          onChange={setMode}
          aria-label="Tryb zapisu szablonu"
        />
      )}

      {mode === 'overwrite' ? (
        <SimpleSelect
          value={overwriteName}
          onValueChange={setOverwriteName}
          placeholder="Wybierz szablon do nadpisania"
          options={existingPresets.map((preset) => ({ value: preset.name, label: preset.name }))}
        />
      ) : (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwa szablonu"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) void handleSave()
          }}
        />
      )}

      {mode === 'overwrite' && (
        <p className="text-destructive text-xs">
          Nadpisanie trwale zastąpi zawartość wybranego szablonu — tej operacji nie można cofnąć.
        </p>
      )}
    </FormDialogShell>
  )
}
