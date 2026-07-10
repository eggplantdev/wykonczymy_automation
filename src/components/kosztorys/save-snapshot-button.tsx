'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { saveSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import { toastMessage } from '@/lib/utils/toast'

// "Zapisz jako…" — capture a named manual snapshot. Self-contained: the save never remounts the
// editor, so it owns its dialog state and reports via toast rather than lifting state up.
export function SaveSnapshotButton({ investmentId }: { investmentId: number }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const label = name.trim()
    if (!label) return
    setSaving(true)
    const res = await saveSnapshotAction(investmentId, label)
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać wersji', 'error', 4000)
      return
    }
    toastMessage('Zapisano wersję', 'success')
    setOpen(false)
    setName('')
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Zapisz jako…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader
            title="Zapisz wersję"
            description="Nazwij zapisywany punkt, aby wrócić do niego później."
          />
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa wersji"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) void handleSave()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
