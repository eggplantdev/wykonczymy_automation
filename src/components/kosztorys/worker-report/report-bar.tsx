import type { ReactNode } from 'react'
import { Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  search: string
  onSearch: (value: string) => void
  options: ReactNode
  className?: string
}

// The gear mirrors the investor's „Opcje” (PreviewHeaderActions).
export function ReportBar({ search, onSearch, options, className }: PropsT) {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="lg" variant="outline" className="ml-auto shrink-0">
            <Settings />
            <span className="max-sm:sr-only">{t('options')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{options}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
