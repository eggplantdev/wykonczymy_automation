'use client'

import { useState } from 'react'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { SimpleSelect } from '@/components/ui/simple-select'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

const PRESET_KEEPS_STRUCTURE_ONLY =
  'Szablon zapamiętuje tylko sekcje i prace w tej kolejności. Ceny, mnożniki i tłumaczenia bierze z katalogu prac. Żeby zmienić cenę, użyj „Aktualizuj pozycję w katalogu prac” przy danej pracy.'

export function SavePresetDialog() {
  const { investmentId, isTemplate } = useKosztorysEditorContext()
  const { savePreset } = useEditorActions()
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

  // A szablon overwritten by itself would change nothing — the action refuses it anyway. A kosztorys
  // id is not a szablon id, so only the szablon's own editor has itself to leave out.
  const targets = isTemplate
    ? existingPresets.filter((preset) => preset.id !== investmentId)
    : existingPresets
  const canSave = (mode === 'new' ? name.trim() : overwriteId).length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res = await settleAction(() =>
      savePreset(
        investmentId,
        mode === 'new' ? { mode, name: name.trim() } : { mode, targetId: Number(overwriteId) },
      ),
    )
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error, 'error', 4000)
      return
    }
    toastMessage('Zapisano szablon', 'success')
    if (res.warning) toastMessage(res.warning, 'warning', 6000)
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Zapisz jako nowy szablon…"
      description={`${
        !isTemplate
          ? 'Szablon — wzór kosztorysu wielokrotnego użytku, niezależny od tej inwestycji.'
          : 'Zapisuje kopię bieżącej rozpiski jako osobny szablon. Ten, który edytujesz, się nie zmienia.'
      } ${PRESET_KEEPS_STRUCTURE_ONLY}`}
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
