'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CatalogueItemFromKosztorysDialog } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/report/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/report/sheet-report-dialog'
import { ReportFold } from '@/components/kosztorys/editor/dialogs/report/sheet-report-parts'
import { CatalogueDiffTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table'
import { CatalogueMissingList } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list'
import {
  diffsVerdict,
  emptyReportReason,
  matchingVerdict,
  missingVerdict,
} from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-compare-words'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { differenceNoun, itemNoun } from '@/lib/kosztorys/counted-nouns'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { attachCatalogueHints } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import {
  CATALOGUE_DIVERGENCE_CONDITION_ID,
  CATALOGUE_MISSING_CONDITION_ID,
} from '@/lib/kosztorys/row-conditions/registry'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

export function CatalogueCompareDialog() {
  const { open, setOpen: onOpenChange } = useKosztorysActions().catalogueCompare
  const {
    readOnly,
    catalogueComparison,
    workCatalogue,
    handleApplyCatalogueToItems,
    handleAcceptCatalogueName,
    engagedConditionIds,
    toggleConditionExclusive,
    noun,
  } = useKosztorysEditorContext()
  // One dialog for the whole list, keyed by the praca it is about — mounting one per row would fetch
  // a preview for every „brak w katalogu" position the moment the fold opens.
  const [savingItemId, setSavingItemId] = useState<number | null>(null)

  // The „może chodzi o…" guesses, dice-matched against every entry in the cennik: O(pozycje ×
  // katalog), 10.7 s at 400 probes.
  const withHints = useDeferredValue(open)
  const report = useMemo(() => {
    if (!catalogueComparison) return null
    if (!withHints) return catalogueComparison
    return {
      ...catalogueComparison,
      missing: attachCatalogueHints(catalogueComparison.missing, workCatalogue ?? []),
    }
  }, [withHints, catalogueComparison, workCatalogue])

  // Engaging, never toggling: the shared helper drops a condition that is
  // already on, so on a second visit „Pokaż w rozpisce" would UNDO the narrowing it promises.
  function narrowTo(conditionId: string) {
    if (!engagedConditionIds.has(conditionId)) toggleConditionExclusive(conditionId, PROBLEM_IDS)
    onOpenChange(false)
  }

  return (
    <>
      <SheetReportDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Porównaj z katalogiem prac"
        description={`Gdzie ceny i stawki tego ${noun.genitive} odbiegają od katalogu — i czego w katalogu jeszcze nie ma.`}
        loaded
        data={report}
        error={emptyReportReason(workCatalogue?.length ?? 0)}
      >
        {({ matching, diffs, missing }) => {
          const figureCount = diffs.reduce((sum, diff) => sum + diff.figures.length, 0)
          return (
            <>
              <SheetReportBlock
                title="Zgodne z katalogiem"
                status={matching > 0 ? 'ok' : 'warn'}
                verdict={matchingVerdict(matching)}
              />

              <SheetReportBlock
                title="Inne liczby niż w katalogu"
                status={diffs.length === 0 ? 'ok' : 'warn'}
                verdict={diffsVerdict(diffs.length)}
              >
                {diffs.length > 0 && !readOnly && (
                  <ShowInRozpiskaButton
                    onClick={() => narrowTo(CATALOGUE_DIVERGENCE_CONDITION_ID)}
                  />
                )}
                {diffs.length > 0 && (
                  <ReportFold
                    summary={`Pokaż ${diffs.length} ${itemNoun(diffs.length)} — ${figureCount} ${differenceNoun(figureCount)}`}
                  >
                    <CatalogueDiffTable
                      diffs={diffs}
                      readOnly={readOnly}
                      onApply={handleApplyCatalogueToItems}
                      onEditInCatalogue={setSavingItemId}
                    />
                  </ReportFold>
                )}
              </SheetReportBlock>

              <SheetReportBlock
                title="Brak w katalogu"
                status={missing.length === 0 ? 'ok' : 'warn'}
                verdict={missingVerdict(missing.length)}
              >
                {missing.length > 0 && !readOnly && (
                  <ShowInRozpiskaButton onClick={() => narrowTo(CATALOGUE_MISSING_CONDITION_ID)} />
                )}
                {missing.length > 0 && (
                  <ReportFold summary={`Pokaż ${missing.length} ${itemNoun(missing.length)}`}>
                    <CatalogueMissingList
                      missing={missing}
                      catalogue={workCatalogue ?? []}
                      readOnly={readOnly}
                      onAcceptName={handleAcceptCatalogueName}
                      onAddToCatalogue={setSavingItemId}
                    />
                  </ReportFold>
                )}
              </SheetReportBlock>
            </>
          )
        }}
      </SheetReportDialog>
      {savingItemId !== null && (
        <CatalogueItemFromKosztorysDialog
          itemId={savingItemId}
          catalogue={workCatalogue ?? []}
          open
          onOpenChange={() => setSavingItemId(null)}
        />
      )}
    </>
  )
}

function ShowInRozpiskaButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="link" size="xs" className="h-auto p-0" onClick={onClick}>
      Pokaż w rozpisce
    </Button>
  )
}
