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
  // Empty for a menu built entirely out of `toggles`, which then renders as one trigger with a count
  // instead of a row of loose buttons in the grid.
  values?: string[]
  onValuesChange?: (values: string[]) => void
  options?: OptionT[]
  /**
   * Ticked, unclickable, and outside the selection entirely — never written to the param, counted, or
   * touched by „Zaznacz wszystkie". For a list whose scope already guarantees them: „Tryb anulowań"
   * offers „Anulowanie" beside types it can narrow, and a dead tick is the honest way to show it.
   */
  lockedValues?: string[]
  label: string
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  searchable?: boolean
  triggerClassName?: string
  // For tight surfaces where a tooltip carries the meaning.
  iconOnly?: boolean
  title?: string
  // Replaces the flipping „Zaznacz/Odznacz wszystkie" pair with one fixed sentence that ticks once
  // carried out. Its ON state is „nothing selected", so it reads as the opposite of the list.
  bulkToggleLabel?: string
  // Rows that tick a whole SUBSET of the options at once. Both hooks read the live local selection
  // rather than state of their own, so unticking one member by hand unticks the group row with it.
  optionToggles?: ReadonlyArray<{
    label: string
    isActive: (current: string[]) => boolean
    select: (current: string[]) => string[]
  }>
  // Caller-owned on/off rows above the options, so one menu can answer „czego nie widzę" with more
  // than the option list instead of splitting it across triggers.
  toggles?: ReadonlyArray<{
    id: string
    label: string
    active: boolean
    onToggle: () => void
    disabled?: boolean
  }>
  togglesHeading?: string
  // For the two groups this component owns; the toggle groups carry their own. Worth setting once a
  // menu mixes rows acting on different things — a bare separator never says what each group is.
  actionsHeading?: string
  optionsHeading?: string
  // A Button rather than a row with a checkmark because it is the one thing in the menu that is an
  // action, not a state — its effect is to leave nothing engaged, so a tick would report nothing.
  // `onReset` covers whatever the caller keeps outside the option list.
  resetAction?: { label: string; onReset: () => void; disabled?: boolean }
  // Replaces the derived „how many options are ticked" count, for a caller whose menu hides things by
  // more than the option list.
  triggerCount?: number
  // Widens the panel for a menu whose rows are sentences rather than labels.
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

  function deriveSelected(vals: string[]) {
    const hasNone = vals.length === 1 && vals[0] === FILTER_NONE
    const hasNoFilter = vals.length === 0
    return hasNone ? [] : hasNoFilter ? allValues : vals
  }

  const selected = localSelected ?? deriveSelected(values)
  const allSelected = selected.length === selectableOptions.length

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

  // Every toggle that is on, default or not: it IS narrowing the list, and once the panel is closed
  // the trigger is the only place that says so.
  const activeToggleCount =
    toggles?.filter((toggle) => !toggle.disabled && toggle.active).length ?? 0

  // Whatever the trigger counts is what it highlights, or the two disagree for a caller whose menu
  // hides more than the option list. Two expressions, because highlighted is not „count > 0": „nic
  // nie zaznaczone" is a filter that counts zero and still has to light up.
  const isFiltered = triggerCount == null ? !allSelected || activeToggleCount > 0 : triggerCount > 0
  const triggerBadgeCount = triggerCount ?? (allSelected ? 0 : selected.length) + activeToggleCount

  // In fixed-label mode the row's tick decides the direction, so clicking it does what the sentence
  // says. The flipping label keeps its own meaning: „everything is on → turn it off".
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
      {/* A fixed label says nothing about whether it was carried out, so that mode keeps a state
          tick. The flipping label names the direction itself. */}
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
      {/* Grows to whatever Radix measured between the trigger and the viewport edge. cmdk's stock
          list is capped at 300px flat, which on a phone cut a 13-option menu in half. */}
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
              // `resetAction.disabled` speaks for what the caller owns outside this list; the local
              // half is judged here, or the button stays dead for the whole debounce after a click.
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
                {/* Uncaptioned, the bulk rows act on the list below, so they belong inside its group
                  rather than in a mute one above it. */}
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
