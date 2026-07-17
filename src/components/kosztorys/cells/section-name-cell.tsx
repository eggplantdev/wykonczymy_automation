import { useRef, useState } from 'react'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Renames the WHOLE section, so it commits through onRename (the same fan-out the section panel uses)
// — never setRowData, which would rewrite only this row's copy of the denormalized name. Local draft
// while editing; the row's canonical value shows otherwise, so an external rename (from the panel) is
// reflected without a mount-time snapshot going stale. Enter/blur commit, Escape reverts. A stray grid
// Delete is a no-op (deleteValue returns the row) so it can't blank the section.
export function SectionNameCell({
  rowData,
  onRename,
}: {
  rowData: KosztorysV2RowT
  onRename?: (sectionId: number, name: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  // Escape sets this before blur so the shared onBlur commit knows to skip the rename.
  const cancelRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={inputRef}
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={editing ? draft : (rowData.sectionName ?? '')}
      onFocus={() => {
        cancelRef.current = false
        setDraft(rowData.sectionName ?? '')
        setEditing(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (editing && !cancelRef.current) onRename?.(rowData.sectionId, draft)
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          inputRef.current?.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancelRef.current = true
          inputRef.current?.blur()
        }
      }}
    />
  )
}
