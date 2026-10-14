import { InvestmentNoteBody } from '@/components/investments/investment-note-body'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

const AI_NOTES_STORAGE_KEY = 'investment:ai-notes'

export function InvestmentAiNotes({ aiNotes }: { aiNotes: string }) {
  if (!aiNotes.trim()) return null

  return (
    <CollapsibleSection
      title="Uwagi AI"
      storageKey={AI_NOTES_STORAGE_KEY}
      size="sm"
      withSeparator={false}
      className="text-sm"
    >
      <InvestmentNoteBody note={aiNotes} />
    </CollapsibleSection>
  )
}
