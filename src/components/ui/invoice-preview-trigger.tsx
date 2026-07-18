import { FileText, Search } from 'lucide-react'

type InvoicePreviewTriggerPropsT = {
  isImage: boolean
  label: string
  onClick: () => void
}

export function InvoicePreviewTrigger({ isImage, label, onClick }: InvoicePreviewTriggerPropsT) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Podgląd: ${label}`}
      className="border-input text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/50 flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors"
    >
      {isImage ? <Search className="shrink-0" /> : <FileText className="shrink-0" />}
      <span className="truncate text-sm">{label}</span>
    </button>
  )
}
