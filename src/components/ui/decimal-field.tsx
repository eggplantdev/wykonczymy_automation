'use client'

import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { cn } from '@/lib/utils/cn'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { NOTICE_MS, rejectedEntryMessage } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

// What an entry resolves to: a number to write, a refusal the user is told about, or nothing to do
// (cleared, with no `emptyAs` to clear to).
type EntryT = { kind: 'commit'; value: number } | { kind: 'reject' } | { kind: 'none' }

type PropsT = {
  // Omitted where an enclosing block already names the figure — a second „Stawka" over one input is
  // noise, not a label.
  label?: ReactNode
  // Stack the label over the input instead of beside it. For a label too long to sit inline without
  // pushing the input off the row („Stawka vat na materiały").
  labelAbove?: boolean
  // Shown as an (i) icon beside the label — the input stays a clean text field. An icon, not a
  // hover target on the label text: nothing about bare text says a hint is hiding behind it.
  hint?: string
  suffix?: ReactNode
  value: number | null
  placeholder?: number
  // Colours the value only; a direct color on the input overrides the muted colour the label inherits.
  valueClassName?: string
  // Accepted range. An entry outside it is REJECTED here — no commit, the field restores `value` and
  // says so in the grid cell's sentence — rather than travelling to the server action to come back as
  // a Zod error toast. Never clamp in `onCommit` instead: „230" meant „23", and saving 100% keeps a
  // number nobody typed (EX-819). A bound the action already enforces belongs on the input too.
  min?: number
  max?: number
  // What a cleared field commits. Without it, blanking the input is a silent no-op — the field looks
  // empty while the old value is still stored, so „skasuj kwotę" never actually clears anything.
  emptyAs?: number
  // Commit behind a „Zapisz" button instead of on blur. For a field whose write reshapes figures
  // across the whole panel, where leaving the input must not be enough to trigger it — the same
  // contract DiscountValueField holds for the rabat kwota, so the settings popover reads as one form.
  withSave?: boolean
  disabled?: boolean
  onCommit: (n: number) => void
}

// Uncontrolled + `key` on the value (remount after router.refresh), commit on blur/Enter — no
// useEffect (project rule).
export function DecimalField({
  label,
  labelAbove = false,
  hint,
  suffix,
  value,
  placeholder,
  valueClassName,
  min,
  max,
  emptyAs,
  withSave = false,
  disabled = false,
  onCommit,
}: PropsT) {
  const text = value == null ? '' : String(value)
  // What has been typed since the last time `value` moved. `null` = untouched, which is what keeps
  // „Zapisz" inert until something actually changed — the button doubles as the answer to „did my
  // edit go through". Only read in withSave mode; blur-commit reads the event's own target.
  const [typed, setTyped] = useState<string | null>(null)
  // A landed write (or an undo, or a rolled-back save) moves `value` without touching this input.
  // Resync so the button can't stay armed over an edit the field no longer shows.
  const [seenText, setSeenText] = useState(text)
  if (seenText !== text) {
    setSeenText(text)
    setTyped(null)
  }

  // Bumped to remount the input on a restore: it is uncontrolled and its `key` only moves when `value`
  // CHANGES, so a refused entry would otherwise stay on screen as text the app has not accepted.
  const [restores, setRestores] = useState(0)

  const outOfRange = (n: number) => (min != null && n < min) || (max != null && n > max)

  const entryOf = (raw: string): EntryT => {
    const parsed = parseDecimalInput(raw)
    if (parsed.kind === 'empty')
      return emptyAs == null ? { kind: 'none' } : { kind: 'commit', value: emptyAs }
    if (parsed.kind === 'invalid' || outOfRange(parsed.value)) return { kind: 'reject' }
    return { kind: 'commit', value: parsed.value }
  }

  // `null` while nothing has been typed — a refused entry still arms „Zapisz", because a button that
  // silently greys out over „230" is the same unexplained refusal as a silent snap-back.
  const pending = typed == null || typed === text ? null : entryOf(typed)
  const canSave = pending != null && pending.kind !== 'none'

  const restore = () => {
    setTyped(null)
    setRestores((count) => count + 1)
  }

  const settle = (entry: EntryT) => {
    if (entry.kind === 'commit') return onCommit(entry.value)
    if (entry.kind === 'reject') {
      const restored =
        value == null
          ? null
          : // Full precision, because `toLocaleString`'s default stops at 3 decimals while the input
            // restores all of them — and four is the norm for a coefficient (0,5525 is the shipped
            // own-tools ceiling). A rounded figure here names a value the field did not restore.
            `${value.toLocaleString('pl-PL', { maximumFractionDigits: 20 })}${
              typeof suffix === 'string' ? suffix : ''
            }`
      toastMessage(rejectedEntryMessage(restored), 'error', NOTICE_MS)
    }
    restore()
  }

  return (
    <label
      className={cn(
        'text-muted-foreground flex gap-1 text-xs',
        labelAbove ? 'flex-col items-start' : 'items-center',
      )}
    >
      {(label || hint) && (
        <span className="flex items-center gap-1">
          {label}
          {hint && <InfoTooltip content={hint} />}
        </span>
      )}
      <span className="flex items-center gap-1">
        <DecimalInput
          key={`${text || 'null'}:${restores}`}
          defaultValue={text}
          placeholder={placeholder != null ? String(placeholder) : ''}
          // A „Zapisz" beside the input means the pair reads as one control, so the input borrows the
          // Button's radius. Height stays the compact h-6 that lines up with the toolbar's selects.
          className={cn(withSave && 'rounded-md', valueClassName)}
          disabled={disabled}
          onChange={withSave ? (e) => setTyped(e.target.value) : undefined}
          onBlur={withSave ? undefined : (e) => settle(entryOf(e.target.value))}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== 'Enter') return
            if (!withSave) e.currentTarget.blur()
            else if (canSave) settle(pending)
          }}
        />
        {suffix}
        {withSave && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={disabled || !canSave}
            onClick={() => canSave && settle(pending)}
          >
            Zapisz
          </Button>
        )}
      </span>
    </label>
  )
}
