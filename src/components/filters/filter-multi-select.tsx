'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCheck, CheckIcon, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import { cn } from '@/lib/utils/cn'

type OptionT = { value: string; label: string }

type FilterMultiSelectPropsT = {
  // Empty for a menu built entirely out of `toggles` — it then renders as one trigger with a count,
  // the same as every other filter, instead of a row of loose buttons in the grid.
  values?: string[]
  onValuesChange?: (values: string[]) => void
  options?: OptionT[]
  /**
   * Options that are ticked, unclickable, and outside the selection entirely — never written to the
   * param, never counted, never touched by „Zaznacz wszystkie". For a list whose scope already
   * guarantees them: the „Tryb anulowań" Typ menu offers „Anulowanie" beside types it can actually
   * narrow, and an untickable-looking tick is the only honest way to render one it cannot.
   */
  lockedValues?: string[]
  label: string
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  searchable?: boolean
  triggerClassName?: string
  // Render just the icon (no label / count) — for tight surfaces where a tooltip carries the meaning.
  iconOnly?: boolean
  title?: string
  // Replaces the flipping „Zaznacz/Odznacz wszystkie" pair with one fixed sentence that ticks when it
  // has been carried out. Its ON state is "nothing selected", so it reads as the opposite of the list.
  bulkToggleLabel?: string
  // Rows that tick a whole SUBSET of the options at once ("every section with no executed work").
  // They obey the same grammar as the options below them — a tick means "selected" — so both hooks
  // read the live local selection rather than any state of their own: `isActive` decides the tick,
  // `select` maps the current selection to the next one. Untick one member by hand and the group row
  // unticks with it, which is what keeps the two halves from ever disagreeing.
  optionToggles?: ReadonlyArray<{
    label: string
    isActive: (current: string[]) => boolean
    select: (current: string[]) => string[]
  }>
  // On/off rows above the options, owned entirely by the caller, under their own caption. Lets one
  // menu answer one question („czego nie widzę") with more than the option list behind it, instead of
  // splitting the answer across triggers the user has to check separately.
  toggles?: ReadonlyArray<{
    id: string
    label: string
    active: boolean
    onToggle: () => void
    disabled?: boolean
  }>
  togglesHeading?: string
  // Group captions for the two groups this component owns: the bulk actions and the option list. The
  // toggle groups above carry their own. Worth setting once a menu mixes rows that act on different
  // things — unlabelled, a separator only says "these are different", never what each group is about.
  actionsHeading?: string
  optionsHeading?: string
  // A one-click way back to "wszystko widać". It sits above the list as a Button rather than a row
  // with a checkmark because it is the one thing in the menu that is an action, not a state — its
  // own effect is to leave nothing engaged, so a tick would have nothing to report afterwards.
  // `onReset` covers whatever the caller keeps outside the option list; the option list itself is
  // reset here.
  resetAction?: { label: string; onReset: () => void; disabled?: boolean }
  // Replaces the trigger's derived "how many options are ticked" count (hidden at 0). For a caller
  // whose menu hides things by more than the option list, where the ticked count would answer a
  // question nobody asked.
  triggerCount?: number
  // Widens the panel past the shared default, for a menu whose rows are sentences rather than
  // labels.
  contentClassName?: string
}

// URL param encoding: [] = all selected (no filter), ['__none__'] = nothing selected
export const FILTER_NONE = '__none__'
const DEBOUNCE_MS = 600

export function FilterMultiSelect({
  values = [],
  onValuesChange = () => {},
  options = [],
  lockedValues,
  label,
  icon: Icon,
  iconPosition = 'left',
  searchable = false,
  triggerClassName,
  iconOnly = false,
  title,
  bulkToggleLabel,
  optionToggles,
  toggles,
  togglesHeading,
  resetAction,
  actionsHeading,
  optionsHeading,
  triggerCount,
  contentClassName,
}: FilterMultiSelectPropsT) {
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLocked = (value: string) => lockedValues?.includes(value) ?? false
  const selectableOptions = options.filter((o) => !isLocked(o.value))
  const allValues = selectableOptions.map((o) => o.value)

  // Decode URL params → actual selection (inverse of flush)
  function deriveSelected(vals: string[]) {
    const hasNone = vals.length === 1 && vals[0] === FILTER_NONE
    const hasNoFilter = vals.length === 0
    return hasNone ? [] : hasNoFilter ? allValues : vals
  }

  const selected = localSelected ?? deriveSelected(values)
  const allSelected = selected.length === selectableOptions.length

  // Encode selection → URL params (inverse of deriveSelected)
  function flush(next: string[]) {
    const allAreSelected = next.length === selectableOptions.length
    if (allAreSelected) onValuesChange([])
    else if (next.length === 0) onValuesChange([FILTER_NONE])
    else onValuesChange(next)
  }

  function scheduleFlush(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flush(next)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSelected(deriveSelected(values))
      setOpen(true)
      return
    }

    if (debounceRef.current && localSelected) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      flush(localSelected)
    }
    setLocalSelected(null)
    setOpen(false)
  }

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected ? selected.filter((v) => v !== value) : [...selected, value]
    const result = next.length === 0 ? [] : next
    setLocalSelected(result)
    scheduleFlush(result)
  }

  // What the trigger reports beyond the option list: every toggle that is on, default or not. A row
  // that is on IS narrowing the list, and the trigger is the only place that says so once the panel
  // is closed. Skipped entirely when the caller counts for itself via `triggerCount`.
  const activeToggleCount =
    toggles?.filter((toggle) => !toggle.disabled && toggle.active).length ?? 0

  // Whatever the trigger counts is what it highlights, or the badge and the highlight would disagree
  // for a caller whose menu hides more than the option list. Two expressions and not one, because
  // highlighted is NOT simply "count > 0": „nic nie zaznaczone" is a filter that happens to count
  // zero, and it has to light up while still reading ` (0)`.
  const isFiltered = triggerCount == null ? !allSelected || activeToggleCount > 0 : triggerCount > 0
  const triggerBadgeCount = triggerCount ?? (allSelected ? 0 : selected.length) + activeToggleCount

  // In fixed-label mode the row's own tick decides the direction, so clicking it always does what the
  // sentence says. The flipping-label mode keeps its original meaning: "everything is on → turn it off".
  const bulkActive = selected.length === 0

  function toggleAll() {
    const selectAll = bulkToggleLabel ? bulkActive : !allSelected
    const next = selectAll ? [...allValues] : []
    setLocalSelected(next)
    scheduleFlush(next)
  }

  // Flushes straight through: a pending debounce from the clicks being undone would land after the
  // reset and put them back.
  function handleReset() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setLocalSelected([...allValues])
    onValuesChange([])
    resetAction?.onReset()
  }

  function runOptionToggle(select: (current: string[]) => string[]) {
    const next = select(selected)
    setLocalSelected(next)
    scheduleFlush(next)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const actionRows = (
    <>
      {/* A fixed label says nothing about whether it has been carried out, so that mode keeps a
          state tick. The flipping label names the direction itself — there the double check just
          marks the row as the bulk one. */}
      <CommandItem onSelect={toggleAll}>
        {bulkToggleLabel ? (
          <CheckIcon className={cn(!bulkActive && 'opacity-0')} />
        ) : (
          <CheckCheck />
        )}
        {bulkToggleLabel ?? (allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie')}
      </CommandItem>
      {optionToggles?.map((group) => (
        <CommandItem
          key={group.label}
          value={group.label}
          onSelect={() => runOptionToggle(group.select)}
        >
          <CheckIcon className={cn(!group.isActive(selected) && 'opacity-0')} />
          {group.label}
        </CommandItem>
      ))}
    </>
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          active={isFiltered}
          icon={Icon}
          iconPosition={iconPosition}
          className={triggerClassName}
          title={title}
        >
          {iconOnly ? null : (
            <>
              {label}
              {isFiltered ? ` (${triggerBadgeCount})` : ''}
            </>
          )}
        </FilterTriggerButton>
      </PopoverTrigger>
      {/* The panel grows to whatever Radix measured between the trigger and the viewport edge, and
          the list scrolls inside it. cmdk's stock list is capped at 300px flat, which on a phone cut
          a 13-option menu in half while the screen below it sat empty. */}
      <PopoverContent
        className={cn(
          // `overflow-hidden`, not the primitive's `overflow-y-auto`: the inner CommandList is what
          // scrolls, so the header and footer stay put while the options move.
          'flex flex-col overflow-hidden p-0',
          contentClassName,
        )}
        align="start"
      >
        {resetAction && (
          <div className="border-border border-b p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              // `resetAction.disabled` speaks for what the caller owns outside this list; the list's
              // own half is judged here, on the LOCAL selection. Reading it off the caller too would
              // leave the button dead for the whole debounce after a click it is meant to undo.
              disabled={(resetAction.disabled ?? false) && allSelected}
              onClick={handleReset}
            >
              <RotateCcw />
              {resetAction.label}
            </Button>
          </div>
        )}
        <Command className="min-h-0 flex-1">
          {searchable && <CommandInput placeholder="Szukaj..." />}
          <CommandList className="max-h-none">
            {toggles && toggles.length > 0 && (
              <>
                <CommandGroup heading={togglesHeading}>
                  {toggles.map((toggle) => (
                    <CommandItem
                      key={toggle.id}
                      value={toggle.label}
                      disabled={toggle.disabled}
                      onSelect={toggle.onToggle}
                    >
                      <CheckIcon className={cn(!toggle.active && 'opacity-0')} />
                      {toggle.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {options.length > 0 && <CommandSeparator />}
              </>
            )}
            {actionsHeading && options.length > 0 && (
              <>
                <CommandGroup heading={actionsHeading}>{actionRows}</CommandGroup>
                <CommandSeparator />
              </>
            )}
            {options.length > 0 && (
              <CommandGroup heading={optionsHeading}>
                {/* Uncaptioned, the bulk rows have nothing of their own to sit under — they act on the
                  list below, so they belong inside its group rather than in a mute one above it. */}
                {!actionsHeading && (
                  <>
                    {actionRows}
                    <CommandSeparator className="my-1" />
                  </>
                )}
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    disabled={isLocked(opt.value)}
                    onSelect={() => !isLocked(opt.value) && toggleValue(opt.value)}
                  >
                    <CheckIcon
                      className={cn(
                        !isLocked(opt.value) && !selected.includes(opt.value) && 'opacity-0',
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandEmpty>Brak wyników</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
