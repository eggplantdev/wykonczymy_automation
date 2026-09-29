'use client'

import { useState } from 'react'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { SimpleSelect } from '@/components/ui/simple-select'
import { savePresetAction } from '@/lib/actions/kosztorys-presets'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// "Zapisz jako nowy szablon…" — save this rozpiska as a reusable, cross-investment template, itself
// either a new named template or an overwrite of an existing one.
export function SavePresetDialog() {
  const { investmentId, isTemplate } = useKosztorysEditorContext()
  const { open, setOpen: onOpenChange, existingPresets } = useKosztorysActions().savePreset
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'new' | 'overwrite'>('new')
  const [overwriteId, setOverwriteId] = useState('')
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (next) return
    setName('')
    setMode('new')
    setOverwriteId('')
  }

  // A szablon overwritten by itself would only lose its przedmiar — the action refuses it anyway.
  const targets = existingPresets.filter((preset) => preset.id !== investmentId)
  const canSave = (mode === 'new' ? name.trim() : overwriteId).length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res = await savePresetAction(
      investmentId,
      mode === 'new' ? { mode, name: name.trim() } : { mode, targetId: Number(overwriteId) },
    )
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
      title="Zapisz jako nowy szablon…"
      // A szablon has no „this investment" for a copy to be independent of — the whole sentence is
      // about something that is not there, so it is rewritten, not word-swapped.
      description={
        !isTemplate
          ? 'Szablon — wzór kosztorysu wielokrotnego użytku, niezależny od tej inwestycji. Posłuży do szybkiego założenia kosztorysu na innych inwestycjach.'
          : 'Zapisuje kopię bieżącej rozpiski jako osobny szablon. Ten, który edytujesz, się nie zmienia.'
      }
      confirmLabel="Zapisz"
      onConfirm={() => void handleSave()}
      confirmDisabled={!canSave}
    >
      {targets.length > 0 && (
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
          value={overwriteId}
          onValueChange={setOverwriteId}
          placeholder="Wybierz szablon do nadpisania"
          options={targets.map((preset) => ({ value: String(preset.id), label: preset.name }))}
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
        <Description tone="error" size="xs">
          Nadpisanie zastąpi zawartość wybranego szablonu. Poprzednią przywrócisz z jego „Wersji”.
        </Description>
      )}
    </FormDialogShell>
  )
}
