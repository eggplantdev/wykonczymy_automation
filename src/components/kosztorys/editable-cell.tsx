'use client'

import { cn } from '@/lib/cn'

type OptionT = { value: string; label: string }
type PropsT = {
  value: string | number
  type?: 'text' | 'number'
  align?: 'left' | 'right'
  options?: OptionT[]
  placeholder?: string
  className?: string
  onCommit: (value: string) => void
}

// Komórka edytowalna inline: wygląda jak tekst, na hover/focus pokazuje pole.
// Stan trzyma rodzic (optymistycznie); tu tylko emitujemy zmianę.
export function EditableCell({
  value,
  type = 'text',
  align = 'left',
  options,
  placeholder,
  className,
  onCommit,
}: PropsT) {
  const base = cn(
    'w-full rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none transition-colors',
    'hover:bg-muted focus:bg-background focus:ring-1 focus:ring-ring',
    align === 'right' && 'text-right',
    className,
  )

  if (options) {
    return (
      <select className={base} value={String(value)} onChange={(e) => onCommit(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      className={base}
      type={type}
      step={type === 'number' ? 'any' : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onCommit(e.target.value)}
    />
  )
}
