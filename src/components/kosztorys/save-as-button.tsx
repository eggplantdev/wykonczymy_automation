'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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

// "Zapisz jako…" — one entry point for both save-as flows, chosen by a target toggle:
//   • Wersja  — a named restore point for THIS investment (saveSnapshotAction).
//   • Szablon — a reusable, cross-investment template (savePresetAction), itself either a new named
//     template or an overwrite of an existing one (name picked from the fetched-on-open list).
// Self-contained: the save never remounts the editor, so it owns its dialog state and reports via
// toast. Presets are fetched on open (needed only for the szablon → overwrite picker).
export function SaveAsButton({ investmentId }: { investmentId: number }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<'version' | 'preset'>('version')
  const [name, setName] = useState('')
  const [presetMode, setPresetMode] = useState<'new' | 'overwrite'>('new')
  const [existing, setExisting] = useState<PresetMetaT[]>([])
  const [overwriteName, setOverwriteName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    setTarget('version')
    setName('')
    setPresetMode('new')
    setOverwriteName('')
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
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void handleOpenChange(true)}>
        Zapisz jako…
      </Button>
      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader
            title="Zapisz jako…"
            description="Zapisz jako wersję (punkt przywracania tej inwestycji) lub jako szablon do użycia na innych inwestycjach."
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={target === 'version' ? 'default' : 'outline'}
              onClick={() => setTarget('version')}
            >
              Wersja
            </Button>
            <Button
              size="sm"
              variant={target === 'preset' ? 'default' : 'outline'}
              onClick={() => setTarget('preset')}
            >
              Szablon
            </Button>
          </div>

          {target === 'preset' && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={presetMode === 'new' ? 'default' : 'outline'}
                onClick={() => setPresetMode('new')}
              >
                Nowy
              </Button>
              <Button
                size="sm"
                variant={presetMode === 'overwrite' ? 'default' : 'outline'}
                onClick={() => setPresetMode('overwrite')}
                disabled={existing.length === 0}
              >
                Nadpisz istniejący
              </Button>
            </div>
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
          ) : (
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={() => void handleSave()} disabled={!canSave}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
