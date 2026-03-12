import { MessageSquareText } from 'lucide-react'

type NoteCellPropsT = {
  readonly note: string | null
}

export function NoteCell({ note }: NoteCellPropsT) {
  if (!note) return null

  return (
    <span className="flex items-center gap-1 text-sm" title={note}>
      <MessageSquareText className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="truncate">{note}</span>
    </span>
  )
}
