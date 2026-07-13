'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listPresetsAction, savePresetAction } from '@/lib/actions/kosztorys-presets'
import { saveSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

// "Zapisz jako…" — one entry point for both save-as flows, chosen by a target toggle:
//   • Wersja  — a named restore point for THIS investment (saveSnapshotAction).
//   • Szablon — a reusable, cross-investment template (savePresetAction), itself either a new named
//     template or an overwrite of an existing one (name picked from the fetched list).
// Controlled by the actions menu (KosztorysActionsMenu). Fields reset on close; the preset list is
// fetched lazily when the user picks Szablon (only the overwrite picker needs it).
export function SaveAsDialog({ investmentId, open, onOpenChange }: PropsT) {
  const [target, setTarget] = useState<'version' | 'preset'>('version')
  const [name, setName] = useState('')
  const [presetMode, setPresetMode] = useState<'new' | 'overwrite'>('new')
  const [existing, setExisting] = useState<PresetMetaT[]>([])
  const [overwriteName, setOverwriteName] = useState('')
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (next) return
    setTarget('version')
    setName('')
    setPresetMode('new')
    setOverwriteName('')
  }

  async function handleTargetChange(next: 'version' | 'preset') {
    setTarget(next)
    if (next !== 'preset') return
    const res = await listPresetsAction()
    if (res.success) setExisting(res.data)
  }

  const presetTargetName = presetMode === 'new' ? name.trim() : overwriteName
  const canSave =
    (target === 'version' ? name.trim().length > 0 : presetTargetName.length > 0) && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res =
      target === 'version'
        ? await saveSnapshotAction(investmentId, name.trim())
        : await savePresetAction(investmentId, presetTargetName, presetMode)
    setSaving(false)
    if (!res.success) {
      const fallback =
        target === 'version' ? 'Nie udało się zapisać wersji' : 'Nie udało się zapisać szablonu'
      toastMessage(res.error ?? fallback, 'error', 4000)
      return
    }
    toastMessage(target === 'version' ? 'Zapisano wersję' : 'Zapisano szablon', 'success')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader title="Zapisz jako…" description="Wybierz, co chcesz zapisać." />
        <ToggleGroup
          options={[
            { value: 'version', label: 'Wersja' },
            { value: 'preset', label: 'Szablon' },
          ]}
          value={target}
          onChange={(next) => void handleTargetChange(next)}
          aria-label="Zapisz jako"
        />
        <p className="text-muted-foreground text-xs">
          {target === 'version'
            ? 'Wersja — zapisany stan tego kosztorysu jako punkt przywracania. Dotyczy tylko tej inwestycji; w każdej chwili możesz do niego wrócić przez „Wersje”.'
            : 'Szablon — wzór kosztorysu wielokrotnego użytku , niezależny od tej inwestycji. Posłuży do szybkiego założenia kosztorysu na innych inwestycjach.'}
        </p>

        {target === 'preset' && existing.length > 0 && (
          <ToggleGroup
            options={[
              { value: 'new', label: 'Nowy' },
              { value: 'overwrite', label: 'Nadpisz istniejący' },
            ]}
            value={presetMode}
            onChange={setPresetMode}
            aria-label="Tryb zapisu szablonu"
          />
        )}

        {target === 'preset' && presetMode === 'overwrite' ? (
          <Select value={overwriteName} onValueChange={setOverwriteName}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz szablon do nadpisania" />
            </SelectTrigger>
            <SelectContent>
              {existing.map((preset) => (
                <SelectItem key={preset.id} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {target === 'preset' && presetMode === 'overwrite' && (
          <p className="text-destructive text-xs">
            Nadpisanie trwale zastąpi zawartość wybranego szablonu — tej operacji nie można cofnąć.
          </p>
        )}

        {!(target === 'preset' && presetMode === 'overwrite') && (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={target === 'version' ? 'Nazwa wersji' : 'Nazwa szablonu'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) void handleSave()
            }}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
