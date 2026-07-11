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
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

// "Zapisz jako preset…" — save the current kosztorys as a reusable, cross-investment template.
// Two modes: a new named preset, or overwriting an existing one (its name is picked from the
// fetched-on-open list). Self-contained like SaveSnapshotButton: owns its dialog state, reports
// via toast. On 'overwrite' the chosen preset name is what savePresetAction upserts by.
export function SavePresetButton({ investmentId }: { investmentId: number }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'new' | 'overwrite'>('new')
  const [name, setName] = useState('')
  const [existing, setExisting] = useState<PresetMetaT[]>([])
  const [overwriteName, setOverwriteName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    setMode('new')
    setName('')
    setOverwriteName('')
    const res = await listPresetsAction()
    if (res.success) setExisting(res.data)
  }

  const targetName = mode === 'new' ? name.trim() : overwriteName
  const canSave = targetName.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const res = await savePresetAction(investmentId, targetName, mode)
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać presetu', 'error', 4000)
      return
    }
    toastMessage('Zapisano preset', 'success')
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void handleOpenChange(true)}>
        Zapisz jako preset…
      </Button>
      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader
            title="Zapisz preset"
            description="Zapisz obecny kosztorys jako szablon do użycia na innych inwestycjach."
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={mode === 'new' ? 'default' : 'outline'}
              onClick={() => setMode('new')}
            >
              Nowy
            </Button>
            <Button
              size="sm"
              variant={mode === 'overwrite' ? 'default' : 'outline'}
              onClick={() => setMode('overwrite')}
              disabled={existing.length === 0}
            >
              Nadpisz istniejący
            </Button>
          </div>
          {mode === 'new' ? (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa presetu"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void handleSave()
              }}
            />
          ) : (
            <Select value={overwriteName} onValueChange={setOverwriteName}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz preset do nadpisania" />
              </SelectTrigger>
              <SelectContent>
                {existing.map((preset) => (
                  <SelectItem key={preset.id} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
