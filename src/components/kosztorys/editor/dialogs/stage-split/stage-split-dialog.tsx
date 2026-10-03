'use client'

import { Fragment, useState } from 'react'
import { CheckIcon, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { STAGE_HEADER_COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils/cn'
import { decimalText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
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
import { resolveWorkerName } from '@/lib/kosztorys/payouts-by-worker'
import { splitStagePool } from '@/lib/kosztorys/stage-split'
import { formatPLN } from '@/lib/utils/format-currency'
import { isActiveRef } from '@/lib/utils/is-active-ref'
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
  // A half-typed entry is NaN until it parses; the live figures read it as 0 meanwhile.
  const counted = {
    ...draft,
    members: draft.members.map((member) =>
      Number.isFinite(member.value) ? member : { ...member, value: 0 },
    ),
  }
  const { shares } = splitStagePool(pool, counted)
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  const nameOf = (workerId: number) => resolveWorkerName(workerId, nameById)
  const memberIds = new Set(draft.members.map((member) => member.workerId))
  const addable = workers.filter((worker) => isActiveRef(worker) && !memberIds.has(worker.id))

  // One person is not a split: they take the whole pool, so the mode and the rest pick have nothing
  // to decide.
  const splitting = draft.members.length > 1
  const byAmount = draft.mode === 'amount'
  // A percent split of 100 comes out as the percentages themselves.
  const percentOf = (workerId: number) =>
    `${(splitStagePool(100, counted).shares.get(workerId) ?? 0).toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`
  const removeButton = (workerId: number) => (
    <Button
      variant="ghost"
      size="xs"
      aria-label={`Usuń ${nameOf(workerId)}`}
      onClick={() => setDraft(removeMember(draft, workerId))}
    >
      <X />
    </Button>
  )

  return (
    <FormDialogShell
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Pracownicy etapu „${stageLabel}"`}
      description={`Kwota do podziału (${stageLabel}): ${formatPLN(Math.max(0, pool))}`}
      confirmLabel="Zapisz"
      confirmDisabled={error != null}
      onConfirm={() => {
        onSave(draftToSave(draft))
        onClose()
      }}
      contentClassName="sm:max-w-xl"
    >
      <div className="flex flex-col gap-y-4">
        {splitting && (
          <ToggleGroup
            options={MODE_OPTIONS}
            value={draft.mode}
            onChange={(mode) => setDraft(setMode(draft, mode))}
            aria-label="Sposób podziału"
          />
        )}

        {draft.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {STAGE_HEADER_COPY.workerUnassigned} — dodaj pracownika poniżej.
          </p>
        ) : !splitting ? (
          <div className="flex items-center gap-x-3 text-sm">
            <span className="flex-1 break-words">{nameOf(draft.members[0].workerId)}</span>
            <span className="tabular-nums" data-testid="member-share">
              {formatPLN(shares.get(draft.members[0].workerId) ?? 0)}
            </span>
            {removeButton(draft.members[0].workerId)}
          </div>
        ) : (
          <div
            className={cn(
              'grid items-center gap-x-3 gap-y-2 text-sm',
              byAmount
                ? 'grid-cols-[auto_minmax(0,1fr)_9rem_2rem]'
                : 'grid-cols-[auto_minmax(0,1fr)_8rem_7rem_2rem]',
            )}
          >
            <span className="text-muted-foreground text-xs">Główny</span>
            <span className="text-muted-foreground text-xs">Pracownik</span>
            {!byAmount && <span className="text-muted-foreground text-right text-xs">Udział</span>}
            <span className="text-muted-foreground text-right text-xs">Kwota</span>
            <span />
            {draft.members.map((member) => {
              const share = (
                <span className="text-right tabular-nums" data-testid="member-share">
                  {formatPLN(shares.get(member.workerId) ?? 0)}
                </span>
              )
              return (
                <Fragment key={member.workerId}>
                  {/* Clicking the holder again is a no-op: someone must take the rest, so the only
                      way off it is picking somebody else. */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={member.takesRest}
                    aria-label={`Główny — ${nameOf(member.workerId)}`}
                    className="group hover:bg-accent focus-visible:ring-ring/50 flex size-7 items-center justify-center justify-self-center rounded-sm outline-none focus-visible:ring-3"
                    onClick={() => setDraft(setRestHolder(draft, member.workerId))}
                  >
                    <CheckIcon
                      className={cn(
                        'size-4',
                        !member.takesRest && 'opacity-0 group-hover:opacity-40',
                      )}
                    />
                  </button>
                  <span className="break-words">{nameOf(member.workerId)}</span>
                  {member.takesRest ? (
                    <>
                      {!byAmount && (
                        <span className="text-muted-foreground text-right tabular-nums">
                          {percentOf(member.workerId)}
                        </span>
                      )}
                      {share}
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        {/* Uncontrolled so a half-typed „12," survives; keyed on the mode because a
                            switch zeroes every value underneath it. Garbage goes in as NaN, which
                            the split's own validation refuses, so „Zapisz" can't save a figure
                            nobody sees. */}
                        <Input
                          key={draft.mode}
                          aria-label={`${byAmount ? 'Kwota' : 'Udział'} — ${nameOf(member.workerId)}`}
                          inputMode="decimal"
                          placeholder="0"
                          className="text-right"
                          defaultValue={member.value === 0 ? '' : decimalText(member.value)}
                          onChange={(event) => {
                            const parsed = parseDecimalInput(event.target.value)
                            const value =
                              parsed.kind === 'value'
                                ? parsed.value
                                : parsed.kind === 'empty'
                                  ? 0
                                  : NaN
                            setDraft(setValue(draft, member.workerId, value))
                          }}
                        />
                        <span className="text-muted-foreground">{byAmount ? 'zł' : '%'}</span>
                      </span>
                      {!byAmount && share}
                    </>
                  )}
                  {removeButton(member.workerId)}
                </Fragment>
              )
            })}
          </div>
        )}

        <SearchSelect
          value=""
          items={addable.map((worker) => ({ value: String(worker.id), label: worker.name }))}
          placeholder="Dodaj pracownika..."
          searchPlaceholder={STAGE_HEADER_COPY.searchPlaceholder}
          emptyMessage={STAGE_HEADER_COPY.searchEmpty}
          onChange={(id) => {
            if (id) setDraft(addMember(draft, Number(id)))
          }}
        />

        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </FormDialogShell>
  )
}
