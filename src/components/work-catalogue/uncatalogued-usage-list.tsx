'use client'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import {
  CandidateRow,
  hintLead,
} from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row'
import type { UncataloguedUsageT } from '@/lib/kosztorys/work-catalogue/types'

/**
 * „Używane, a brak w katalogu" — what the kosztorysy price that the cennik has never heard of. Read
 * only: a candidate here is advice about what the praca might BE, and it is never counted into
 * „Kosztorysy" — that column counts exact matches alone, or a near-miss would inflate a wpis nobody
 * actually used. Collapsed, because the list runs long and the table is what the page is for.
 */
export function UncataloguedUsageList({ groups }: { groups: readonly UncataloguedUsageT[] }) {
  return (
    <CollapsibleSection title={`Używane, a brak w katalogu (${groups.length})`} defaultOpen={false}>
      <div className="space-y-2 pt-2 text-xs">
        {groups.map((group) => (
          <div key={group.key} className="border-border/60 space-y-1 border-t pt-1.5 pb-1">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="font-medium">{group.description}</span>
                <span className="text-muted-foreground"> ({group.unit || 'bez j.m.'})</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                kosztorysy: {group.kosztorysCount}
              </span>
            </div>
            {group.hints.length > 0 && (
              <>
                <p className="text-muted-foreground pl-4">{hintLead(group)}</p>
                <div className="pl-4">
                  {group.hints.map((hint) => (
                    <CandidateRow key={hint.id} entry={hint} readOnly />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}
