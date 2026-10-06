'use client'

import { useState } from 'react'
import { CheckIcon, ChevronDown } from 'lucide-react'

import { comboboxCommit } from '@/components/ui/combobox-commit'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

type ComboboxPropsT = {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  allowCustom?: boolean
  hideChevron?: boolean
  /** Set inside a Dialog — see the `modal` note on the Popover below. */
  modal?: boolean
  className?: string
  contentClassName?: string
}

type ItemT = { key: string; label: string; commit: string; checked: boolean }

const CREATE_KEY = '__create__'

// Editable-value combobox: the input holds the actual value (type any custom one when allowCustom),
// the list below is quick-picks — NOT a search/filter box. Focus stays in the input; Arrow keys move
// a highlight (bg-accent, like the app's menus) instead of DOM focus, so there's no stray focus ring
// and Tab doesn't land on options. Radix Popover portals to body (survives a `transform` ancestor);
// keydown is stopped inside so a datasheet grid behind it can't also act on the keys.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = false,
  hideChevron,
  modal = false,
  className,
  contentClassName,
}: ComboboxPropsT) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [active, setActive] = useState(0)
  // Whether the highlight is the user's choice or just where it started. The list never filters by
  // the draft, so an untouched highlight points at an unrelated option — committing it would replace
  // what was typed with the first quick-pick.
  const [picked, setPicked] = useState(false)

  const trimmed = draft.trim()
  const canCreate =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((option) => option.toLowerCase() === trimmed.toLowerCase())

  const items: ItemT[] = [
    ...(canCreate
      ? [{ key: CREATE_KEY, label: `Dodaj „${trimmed}”`, commit: trimmed, checked: false }]
      : []),
    ...options.map((option) => ({
      key: option,
      label: option,
      commit: option,
      checked: option === value,
    })),
  ]

  const openChange = (next: boolean) => {
    if (next) {
      setDraft('')
      setPicked(false)
      const current = options.findIndex((option) => option === value)
      setActive(current < 0 ? 0 : current)
    }
    setOpen(next)
  }
  const commit = (next: string) => {
    onChange(next.trim())
    setOpen(false)
  }
  const highlight = (index: number) => {
    setActive(index)
    setPicked(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // dsg listens for keydown on `document` — stop it here so arrows/typing stay in the input.
    event.stopPropagation()
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlight(Math.min(active + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlight(Math.max(active - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (trimmed.length > 0 && !picked) return commit(comboboxCommit(draft, options))
      commit(items[active] ? items[active].commit : draft)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    // `modal` inside a Dialog: the popover portals to body, so the dialog's focus trap pulls focus
    // straight back out of the draft input — a modal popover pauses the outer scope instead. Off by
    // default because it also locks body scroll, which the grid cell must not do.
    <Popover open={open} onOpenChange={openChange} modal={modal}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn('flex items-center justify-between gap-1 text-sm outline-none', className)}
          aria-label={placeholder}
        >
          <span className="truncate">{value || placeholder}</span>
          {!hideChevron && <ChevronDown className="opacity-50" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-40 p-1', contentClassName)}>
        <Input
          autoFocus
          value={draft}
          placeholder={placeholder}
          className="h-8"
          onChange={(event) => {
            setDraft(event.target.value)
            setActive(0)
            setPicked(false)
          }}
          onKeyDown={handleKeyDown}
        />
        {items.length > 0 && (
          <div className="mt-1 flex flex-col">
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                tabIndex={-1}
                onClick={() => commit(item.commit)}
                onMouseMove={() => highlight(index)}
                className={cn(
                  'flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                  index === active && 'bg-accent',
                )}
              >
                {item.label}
                {item.checked && <CheckIcon className="opacity-70" />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
