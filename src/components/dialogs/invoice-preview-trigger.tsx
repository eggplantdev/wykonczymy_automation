import { FileText } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export type InvoicePreviewTriggerPropsT = {
  label: string
  onClick: () => void
  // `compact` defaults to the ghost icon-button's 36px box but lets `className` override it — the
  // transfers table and a fixed-height virtualized row have different height budgets.
  variant?: 'field' | 'compact'
  className?: string
}

export function InvoicePreviewTrigger({
  label,
  onClick,
  variant = 'field',
  className,
}: InvoicePreviewTriggerPropsT) {
  const isCompact = variant === 'compact'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Podgląd faktury: ${label}`}
      className={cn(
        'text-muted-foreground hover:text-foreground cursor-pointer',
        isCompact
          ? cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'mx-auto')
          : 'border-input hover:border-primary/50 hover:bg-muted/50 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 transition-colors',
        className,
      )}
    >
      <FileText />
      {!isCompact && <span className="truncate text-sm">{label}</span>}
    </button>
  )
}
