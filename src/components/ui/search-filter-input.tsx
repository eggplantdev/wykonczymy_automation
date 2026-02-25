import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

type SearchFilterInputPropsT = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
}

export function SearchFilterInput({
  value,
  onChange,
  placeholder = 'Szukaj...',
}: SearchFilterInputPropsT) {
  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-40 pl-8 text-sm lg:w-56"
      />
    </div>
  )
}
