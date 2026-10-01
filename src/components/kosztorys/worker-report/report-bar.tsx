import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n/use-translation'

type PropsT = {
  search: string
  onSearch: (value: string) => void
  chips: ReactNode
  className?: string
}

export function ReportBar({ search, onSearch, chips, className }: PropsT) {
  const { t } = useTranslation('report')
  return (
    <div className={className}>
      <div className="relative w-full max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">{chips}</div>
    </div>
  )
}
