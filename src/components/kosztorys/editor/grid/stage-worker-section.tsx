'use client'

import { useState } from 'react'

import { DropdownMenuCheckboxRow, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { ActiveFilterLabel } from '@/components/filters/active-filter-label'
import { Input } from '@/components/ui/input'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  workers: WorkerRefT[]
  selectedId: number | null
  onPick: (workerId: number | null) => void
}

// The etap's roster, searchable, inside the header menu itself — no second overlay to hand off to.
// Plain substring filtering rather than cmdk: cmdk owns the arrow keys, and so does the Radix menu
// around it, so the two cannot share one popup. `stopPropagation` on the input's keydown is what buys
// that peace — without it the menu's own typeahead eats every letter and jumps the highlight around.
export function StageWorkerSection({ workers, selectedId, onPick }: PropsT) {
  const [query, setQuery] = useState('')
  // Assigning new work to someone who no longer works here is the rare case, not the default — but it
  // IS a case (a person deactivated mid-investment still owns their etapy), so this is a filter the
  // user can widen rather than a hard exclusion they can't see.
  const [activeOnly, setActiveOnly] = useState(true)

  const needle = query.trim().toLowerCase()
  const listed = activeOrSelected(workers, activeOnly, selectedId).filter((worker) =>
    worker.name.toLowerCase().includes(needle),
  )

  return (
    <>
      <DropdownMenuLabel>{COPY.workerSectionLabel}</DropdownMenuLabel>
      <div
        className="flex flex-col gap-y-2 px-2 pb-2"
        onKeyDown={(event) => event.stopPropagation()}
      >
        {/* The filter reads first: it says which roster the search below is searching. */}
        <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} activeLabel="Aktywni" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={COPY.searchPlaceholder}
          className="h-8"
        />
      </div>

      {/* Above the search results and never filtered out: clearing the assignment is an action, not a
          name to find. */}
      <DropdownMenuCheckboxRow
        checked={selectedId == null}
        onCheckedChange={() => onPick(null)}
        label={COPY.workerUnassigned}
      />

      {/* Bounded so a roster of thirty can't push „Usuń etap" off the screen. */}
      <div className="max-h-48 overflow-y-auto">
        {listed.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">{COPY.searchEmpty}</p>
        ) : (
          listed.map((worker) => (
            <DropdownMenuCheckboxRow
              key={worker.id}
              checked={selectedId === worker.id}
              onCheckedChange={() => onPick(worker.id)}
              label={worker.name}
            />
          ))
        )}
      </div>
    </>
  )
}
