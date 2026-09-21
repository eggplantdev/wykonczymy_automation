'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CatalogueItemFromKosztorysDialog } from '@/components/kosztorys/editor/dialogs/catalogue-item-from-kosztorys-dialog'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/sheet-report-block'
import { SheetReportDialog } from '@/components/kosztorys/editor/dialogs/sheet-report-dialog'
import {
  ComparisonRow,
  ComparisonTable,
  ItemList,
  ReportFold,
} from '@/components/kosztorys/editor/dialogs/sheet-report-parts'
import {
  diffsVerdict,
  emptyReportReason,
  matchingVerdict,
  missingVerdict,
} from '@/components/kosztorys/editor/dialogs/catalogue-compare-words'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { differenceNoun, itemNoun } from '@/lib/kosztorys/counted-nouns'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { attachCatalogueHints } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import {
  CATALOGUE_DIVERGENCE_CONDITION_ID,
  CATALOGUE_MISSING_CONDITION_ID,
} from '@/lib/kosztorys/row-conditions/registry'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'
import { formatPLN } from '@/lib/utils/format-currency'

/**
 * „Porównaj z katalogiem" — the rozpiska read against the global cennik. Nothing here touches the
 * KOSZTORYS: unlike the arkusz window it has no refresh side, so no figure the owner is looking at
 * can move. Its writes all go the other way, into the cennik — „Dodaj do katalogu" on a praca it
 * lacks, „Edytuj w katalogu" on one whose liczby drifted — which is why the whole report stays open
 * to a read-only viewer while those two entries do not.
 *
 * The report is the SAME comparison the „Problemy" counters read, taken off the editor context, so
 * the window and the toolbar can never disagree — and it is already computed when the window opens.
 */
export function CatalogueCompareDialog() {
  const { open, setOpen: onOpenChange } = useKosztorysActions().catalogueCompare
  const {
    readOnly,
    catalogueComparison,
    workCatalogue,
    engagedConditionIds,
    toggleConditionExclusive,
  } = useKosztorysEditorContext()
  const router = useRouter()
  // One dialog for the whole list, keyed by the praca it is about — mounting one per row would fetch
  // a preview for every „brak w katalogu" position the moment the fold opens.
  const [savingItemId, setSavingItemId] = useState<number | null>(null)

  // The „może chodzi o…" guesses, dice-matched against every entry in the cennik: O(pozycje ×
  // katalog), 10.7 s at 400 probes. It may therefore never ride along with the classification that
  // feeds the counters — it runs here, once, and only for a window someone actually opened.
  //
  // Deferred rather than gated on `open`: the report then paints hint-free on the opening frame and
  // the scoring lands in the next, so the click that opens the window is never the click that blocks
  // the main thread for a second. It also keeps the report non-null while the window animates shut,
  // which a hard gate turned into a flash of the „brak" state on every close.
  const withHints = useDeferredValue(open)
  const report = useMemo(() => {
    if (!catalogueComparison) return null
    if (!withHints) return catalogueComparison
    return {
      ...catalogueComparison,
      missing: attachCatalogueHints(catalogueComparison.missing, workCatalogue ?? []),
    }
  }, [withHints, catalogueComparison, workCatalogue])

  // The rozpiska is underneath the window, so a narrowing gesture that left it open would read as a
  // button that did nothing. Engaging, never toggling: the shared helper drops a condition that is
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
        description="Gdzie ceny i stawki tego kosztorysu odbiegają od katalogu — i czego w katalogu jeszcze nie ma."
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
                {/* Both numbers, because they disagree on purpose: one praca can differ on three
                  liczby, so a fold announcing „5" that opens onto ten wiersze reads as a bug in the
                  count rather than as three figures per praca. */}
                {diffs.length > 0 && !readOnly && (
                  <ShowInRozpiskaButton
                    onClick={() => narrowTo(CATALOGUE_DIVERGENCE_CONDITION_ID)}
                  />
                )}
                {diffs.length > 0 && (
                  <ReportFold
                    summary={`Pokaż ${diffs.length} ${itemNoun(diffs.length)} — ${figureCount} ${differenceNoun(figureCount)}`}
                  >
                    <ComparisonTable sides={['Kosztorys', 'Katalog']} withAction={!readOnly}>
                      {diffs.flatMap((diff) =>
                        diff.figures.map((figure, index) => (
                          <ComparisonRow
                            key={`${diff.itemId}-${figure.label}`}
                            label={`${diff.description} — ${figure.label}`}
                            sheet={formatPLN(figure.kosztorys)}
                            app={formatPLN(figure.catalogue)}
                            delta={formatPLN(figure.delta)}
                            // Once per praca, not once per figure: an overwrite carries all three
                            // liczby, so a button on every wiersz would offer the same write three
                            // times under three different numbers.
                            action={
                              readOnly ? undefined : index === 0 ? (
                                <Button
                                  variant="link"
                                  size="xs"
                                  className="h-auto p-0"
                                  onClick={() => setSavingItemId(diff.itemId)}
                                >
                                  Edytuj w katalogu
                                </Button>
                              ) : null
                            }
                          />
                        )),
                      )}
                    </ComparisonTable>
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
                    <ItemList
                      items={missing.map((row) => ({
                        section: row.section,
                        description: `${row.description} (${row.unit || 'bez j.m.'})`,
                        // A guess about NAMES, offered as one — nothing here actually matched.
                        note: row.hint ? `może chodzi o „${row.hint}"` : undefined,
                        action: readOnly ? undefined : (
                          <Button
                            variant="link"
                            size="xs"
                            className="h-auto p-0"
                            onClick={() => setSavingItemId(row.itemId)}
                          >
                            Dodaj do katalogu
                          </Button>
                        ),
                      }))}
                    />
                  </ReportFold>
                )}
              </SheetReportBlock>
            </>
          )
        }}
      </SheetReportDialog>
      {/* Mounted only while a praca is picked, so the preview fetch happens on the click and never
          on opening the report. */}
      {savingItemId !== null && (
        <CatalogueItemFromKosztorysDialog
          itemId={savingItemId}
          open
          onOpenChange={() => setSavingItemId(null)}
          // A fresh cennik, not a re-read of the comparison: the save already invalidated the tag, and
          // `rows` is a mount-frozen seed, so unsaved wiersze survive the refresh.
          onSaved={() => router.refresh()}
        />
      )}
    </>
  )
}

// „Pokaż w rozpisce" reads identically in both blocks and means the same gesture in both, so it is one
// component rather than two copies that could drift apart in wording.
function ShowInRozpiskaButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="link" size="xs" className="h-auto p-0" onClick={onClick}>
      Pokaż w rozpisce
    </Button>
  )
}
