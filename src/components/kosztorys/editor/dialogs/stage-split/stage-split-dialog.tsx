'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { DecimalField } from '@/components/ui/decimal-field'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  addMember,
  draftError,
  draftFrom,
  draftToSave,
  removeMember,
  setMode,
  setRestHolder,
  setValue,
} from '@/lib/kosztorys/stage-split-draft'
import { splitStagePool } from '@/lib/kosztorys/stage-worker-split'
import { formatPLN } from '@/lib/utils/format-currency'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { StageSplitModeT, StageSplitT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

const MODE_OPTIONS: { value: StageSplitModeT; label: string }[] = [
  { value: 'percent', label: 'Procentowo' },
  { value: 'amount', label: 'Kwotowo' },
]

type PropsT = {
  stageLabel: string
  split: StageSplitT | null
  // The etap's executed work at its plane — what is divided, and the cap on fixed amounts.
  pool: number
  workers: WorkerRefT[]
  onSave: (split: StageSplitT | null) => void
  onClose: () => void
}

// Mounted only while open, so the draft starts from the saved split on every opening.
export function StageSplitDialog({ stageLabel, split, pool, workers, onSave, onClose }: PropsT) {
  const [draft, setDraft] = useState(() => draftFrom(split))
  const error = draftError(draft, pool)
  const { shares } = splitStagePool(pool, draft)
  const nameOf = (workerId: number) =>
    workers.find((worker) => worker.id === workerId)?.name ?? 'nieznana osoba'
  const memberIds = new Set(draft.members.map((member) => member.workerId))
  const addable = activeOrSelected(workers, true, null).filter(
    (worker) => !memberIds.has(worker.id),
  )

  return (
    <FormDialogShell
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Pracownicy etapu „${stageLabel}"`}
      description={`Do podziału: ${formatPLN(Math.max(0, pool))} wykonanej pracy.`}
      confirmLabel="Zapisz"
      confirmDisabled={error != null}
      onConfirm={() => {
        onSave(draftToSave(draft))
        onClose()
      }}
    >
      <div className="flex flex-col gap-y-3">
        <ToggleGroup
          options={MODE_OPTIONS}
          value={draft.mode}
          onChange={(mode) => setDraft(setMode(draft, mode))}
          aria-label="Sposób podziału"
        />

        {draft.members.length === 0 ? (
          <p className="text-muted-foreground text-xs">Bez przypisania — dodaj osobę poniżej.</p>
        ) : (
          <ul className="flex flex-col gap-y-2">
            {draft.members.map((member) => (
              <li key={member.workerId} className="flex items-center gap-x-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{nameOf(member.workerId)}</span>
                <label className="text-muted-foreground flex items-center gap-x-1 text-xs">
                  <input
                    type="radio"
                    name="rest-holder"
                    checked={member.takesRest}
                    onChange={() => setDraft(setRestHolder(draft, member.workerId))}
                  />
                  reszta
                </label>
                <div className="w-24">
                  {member.takesRest ? (
                    <span className="text-muted-foreground block text-right text-xs">reszta</span>
                  ) : (
                    <DecimalField
                      value={member.value}
                      min={0}
                      max={draft.mode === 'percent' ? 100 : undefined}
                      emptyAs={0}
                      suffix={draft.mode === 'percent' ? '%' : 'zł'}
                      onCommit={(value) => setDraft(setValue(draft, member.workerId, value))}
                    />
                  )}
                </div>
                <span className="w-24 text-right tabular-nums" data-testid="member-share">
                  {formatPLN(shares.get(member.workerId) ?? 0)}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Usuń ${nameOf(member.workerId)}`}
                  onClick={() => setDraft(removeMember(draft, member.workerId))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Combobox
          modal
          value=""
          options={addable.map((worker) => worker.name)}
          placeholder="Dodaj osobę..."
          onChange={(name) => {
            const worker = addable.find((candidate) => candidate.name === name)
            if (worker) setDraft(addMember(draft, worker.id))
          }}
        />

        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </FormDialogShell>
  )
}
