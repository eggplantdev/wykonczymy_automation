'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  buildAccept,
  catalogueSwap,
  initialDrafts,
  isLineReady,
  lineGroup,
  partitionLines,
  type ItemFiguresT,
  type LineDraftT,
  type LineGroupT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { reviewedDescription } from '@/lib/kosztorys/worker-report/reviewed-description'
import {
  ReviewLinesTable,
  type ReviewRowT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/review-lines-table'
import { retranslateReportLineAction } from '@/lib/actions/worker-report-translation'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import {
  closestEntries,
  hintCandidates,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import type { AcceptTargetT, ReportLineT, WorkerReportT } from '@/lib/kosztorys/worker-report/types'
import { ACCEPT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { isStageMember, resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { itemNounAccusative } from '@/lib/kosztorys/counted-nouns'
import { settleAction } from '@/lib/utils/settle-action'
import { NOTICE_MS, retranslationNotice } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  report: WorkerReportT
  onBack: () => void
  onDecided: () => void
}

const NEW_STAGE = 'new'

const GROUPS: { group: LineGroupT; title: string; hint: string }[] = [
  { group: 'rozpiska', title: 'Z rozpiski', hint: 'Przyjęta ilość dodaje się do wybranego etapu.' },
  {
    group: 'extra',
    title: 'Spoza rozpiski',
    hint: 'Pracownik podał tylko opis, j.m. i ilość. Po przyjęciu trafią do rozpiski jako nowe pozycje bez przedmiaru — uzupełnij sekcję i cenę albo podmień na pracę z katalogu.',
  },
]

export function WorkerReportReview({ report, onBack, onDecided }: PropsT) {
  const { rows, stages, sections, workCatalogue, acceptReport, rejectReport } =
    useKosztorysEditorContext()
  const catalogue = workCatalogue ?? []
  const isPending = report.status === 'pending'
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const [drafts, setDrafts] = useState(() => initialDrafts(report, rows))
  // Only his own etapy: an addition to someone else's would pay that crew for his work.
  const ownStages = stages
    .filter((stage) => isStageMember(stage, report.workerId))
    .toSorted((first, second) => first.ordinal - second.ordinal)
  const scope = resolveWorkerScope(stages, report.workerId)
  // The server holds a later accept to the etap the report already went to, while it exists.
  const recordedStage = ownStages.find((stage) => stage.id === report.target?.stageId)
  const hasRecordedFigures = stages.some((stage) => stage.id === report.target?.stageId)
  // The latest of his etapy is the one work usually continues.
  const [target, setTarget] = useState(() =>
    String(recordedStage?.id ?? ownStages.at(-1)?.id ?? NEW_STAGE),
  )
  const [plane, setPlane] = useState<ToolPlaneT | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  // A retry's answer, laid over the report this dialog was opened with — no refetch of the whole report.
  const [retranslated, setRetranslated] = useState<
    Record<number, Pick<ReportLineT, 'polishDescription' | 'descriptionLanguage'>>
  >({})
  const reportLines = report.lines.map((line) => ({ ...line, ...retranslated[line.id] }))
  const targetStageId = target === NEW_STAGE ? undefined : Number(target)
  const targetStage = ownStages.find((stage) => stage.id === targetStageId)
  const stageTitle = targetStage ? stageLabel(targetStage) : 'Nowy etap'

  const itemIdOf = (line: ReportLineT): number | undefined =>
    line.itemId !== undefined && rowById.has(line.itemId) ? line.itemId : drafts[line.id].itemId
  const figuresOf = (row: KosztorysV2RowT | undefined): ItemFiguresT | undefined => {
    if (!row) return undefined
    return {
      stageQty: targetStageId === undefined ? 0 : (row[stageKey(targetStageId)] ?? 0),
      measuredQty: rowTotalQtyDone(row, stages, 'client'),
      plannedQty: row.plannedQty,
    }
  }
  const sectionOrder = new Map(sections.map((section, index) => [section.sectionName, index]))
  const reviewRows: ReviewRowT[] = reportLines
    .map((line) => {
      const isRozpiska = lineGroup(line, drafts[line.id]) === 'rozpiska'
      const itemId = isRozpiska ? itemIdOf(line) : line.createdItemId
      const row = itemId === undefined ? undefined : rowById.get(itemId)
      const sectionName = row?.sectionName ?? line.sectionName ?? ''
      return {
        ...line,
        sectionName,
        sectionColor: row?.sectionColor ?? null,
        sectionOrder: sectionOrder.get(sectionName) ?? sections.length,
        figures: isRozpiska ? figuresOf(row) : undefined,
        itemDescription: row?.description ?? undefined,
        isUnassigned:
          line.kind === 'rozpiska' && (line.itemId === undefined || !rowById.has(line.itemId)),
        isAccepted: line.acceptedQty !== undefined,
        isFigureLive: hasRecordedFigures && rowById.has(line.createdItemId ?? line.itemId ?? -1),
      }
    })
    .toSorted((first, second) => first.sectionOrder - second.sectionOrder)
  // Scored once per dopisana praca, not per render of a cell: dice over the whole cennik is the
  // expensive part of „Porównaj z katalogiem" too.
  const candidates = hintCandidates(catalogue)
  const hintsByLine = Object.fromEntries(
    reportLines
      .filter((line) => lineGroup(line, drafts[line.id]) === 'extra')
      .map((line) => [line.id, closestEntries(reviewedDescription(line), candidates)]),
  )
  const itemOptions = rows.map((row) => ({
    value: String(row.id),
    label: `${row.description ?? ''} (${row.unit ?? ''}) · ${row.sectionName}`,
  }))
  const targetOptions = [
    ...ownStages.map((stage, index) => ({
      value: String(stage.id),
      label: `${stageLabel(stage)}${index === ownStages.length - 1 ? ' (ostatni)' : ''}`,
    })),
    { value: NEW_STAGE, label: 'Nowy etap' },
  ]
  const planeOptions = TOOL_PLANES.map((value) => ({ value, label: PLANE_LABELS[value] }))
  const sectionOptions = sections.map((section) => ({
    value: String(section.sectionId),
    label: section.sectionName,
  }))

  const {
    open: openLines,
    ticked: tickedLines,
    accepted: acceptedLines,
    changed: changedLines,
    undone: undoneLines,
  } = partitionLines(report.lines, drafts)
  // The rest joins the report's etap, so none can go anywhere while that etap is gone or no longer his.
  const isTiedToLostStage = acceptedLines.length > undoneLines.length && !recordedStage
  const needsPlane = targetStageId === undefined && scope.kind === 'blocked'
  const needsPlanePick = needsPlane && scope.reason === 'no-stages'
  const targetProblem = isTiedToLostStage
    ? ACCEPT_REFUSALS.lostRecordedStage
    : needsPlane && !needsPlanePick
      ? ACCEPT_REFUSALS.unsettledPlane
      : undefined
  const changeCount = tickedLines.length + changedLines.length + undoneLines.length
  // Only a line going into an etap for the first time needs one chosen.
  const isTargetReady =
    tickedLines.length === 0 ||
    (targetProblem === undefined && (!needsPlanePick || plane !== undefined))
  const isReady =
    isTargetReady &&
    report.lines.every((line) => isLineReady(line, drafts[line.id], itemIdOf(line)))

  const updateDraft = (lineId: number, patch: Partial<LineDraftT>) =>
    setDrafts((current) => ({ ...current, [lineId]: { ...current[lineId], ...patch } }))

  const retranslate = async (lineId: number) => {
    const result = await settleAction(() =>
      retranslateReportLineAction(report.investmentId, lineId),
    )
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }
    const before = reportLines.find((line) => line.id === lineId)?.polishDescription
    const { message, kind } = retranslationNotice(before, result.data.polishDescription)
    toastMessage(message, kind, NOTICE_MS)
    setRetranslated((current) => ({
      ...current,
      [lineId]: {
        polishDescription: result.data.polishDescription ?? undefined,
        descriptionLanguage: result.data.descriptionLanguage,
      },
    }))
  }

  const decide = async (run: () => Promise<boolean>, doneMessage: string) => {
    setIsSaving(true)
    const isDone = await run()
    setIsSaving(false)
    if (!isDone) return
    toastMessage(doneMessage)
    onDecided()
  }

  const accept = () => {
    const acceptTarget: AcceptTargetT =
      targetStageId === undefined
        ? { kind: 'new', plane }
        : { kind: 'stage', stageId: targetStageId }
    const { input, cells } = buildAccept(report, drafts, acceptTarget, itemIdOf)
    void decide(
      () => acceptReport(input, cells),
      acceptedLines.length === 0
        ? 'Zgłoszenie przyjęte do rozpiski'
        : 'Zapisano zmiany w zgłoszeniu',
    )
  }

  return (
    <div className="worker-report flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{report.workerName}</h3>
          <p className="text-muted-foreground text-xs">
            Wysłano {formatPLDateTime(report.sentAt)}
            {report.decidedAt &&
              ` · sprawdzono ${formatPLDateTime(report.decidedAt)}${report.decidedBy ? ` (${report.decidedBy})` : ''}`}
          </p>
        </div>
        {report.target && (openLines.length === 0 || recordedStage || isTiedToLostStage) ? (
          <p className="text-sm">
            Dodano do:{' '}
            <span className="font-medium">
              {stageLabel({ ordinal: report.target.ordinal, label: report.target.label ?? null })}
            </span>
          </p>
        ) : (
          openLines.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <Label className="gap-2 text-sm font-normal">
                Dodaj do
                <SimpleSelect
                  value={target}
                  onValueChange={setTarget}
                  options={targetOptions}
                  className="w-56"
                />
              </Label>
              {needsPlanePick && (
                <Label className="gap-2 text-sm font-normal">
                  Rozliczenie
                  <SimpleSelect
                    value={plane ?? ''}
                    onValueChange={(value) => setPlane(value as ToolPlaneT)}
                    options={planeOptions}
                    placeholder="Wybierz"
                    className="w-44"
                  />
                </Label>
              )}
            </div>
          )
        )}
      </div>
      {targetProblem && tickedLines.length > 0 && (
        <p className="text-destructive text-sm">{targetProblem}</p>
      )}

      <div className="max-h-dialog-scroll flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
        {GROUPS.map(({ group, title, hint }) => {
          const lines = reviewRows.filter((row) => lineGroup(row, drafts[row.id]) === group)
          if (lines.length === 0) return null
          return (
            <section key={group}>
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {title} ({lines.length})
              </h4>
              <p className="text-muted-foreground mb-2 text-xs">{hint}</p>
              <ReviewLinesTable
                group={group}
                rows={lines}
                drafts={drafts}
                onChange={updateDraft}
                sectionOptions={sectionOptions}
                itemOptions={itemOptions}
                catalogue={catalogue}
                kosztorysItems={rows}
                onCatalogueSwap={(lineId, entry) => updateDraft(lineId, catalogueSwap(entry, rows))}
                hintsByLine={hintsByLine}
                stageTitle={stageTitle}
                onRetranslate={isPending ? retranslate : undefined}
              />
            </section>
          )
        })}
      </div>

      <DialogFooter>
        {isPending ? (
          <Button
            variant="ghost"
            className="text-destructive mr-auto"
            disabled={isSaving}
            onClick={() => setIsRejectOpen(true)}
          >
            Odrzuć zgłoszenie
          </Button>
        ) : (
          <p className="text-muted-foreground mr-auto self-center text-sm">
            {report.status === 'rejected'
              ? 'Zgłoszenie odrzucone w całości.'
              : `Przyjęto ${report.acceptedLineCount} z ${report.lineCount}.`}
          </p>
        )}
        <Button variant="outline" onClick={onBack}>
          Wszystkie zgłoszenia
        </Button>
        <Button disabled={isSaving || changeCount === 0 || !isReady} onClick={accept}>
          {acceptedLines.length === 0
            ? `Przyjmij ${tickedLines.length} ${itemNounAccusative(tickedLines.length)}`
            : 'Zapisz zmiany'}
        </Button>
      </DialogFooter>

      <ConfirmDialog
        open={isRejectOpen}
        title="Odrzucić całe zgłoszenie?"
        description="Nic nie trafi do rozpiski. Zgłoszenie zostanie w historii jako odrzucone."
        confirmLabel="Odrzuć"
        onConfirm={() => {
          setIsRejectOpen(false)
          void decide(() => rejectReport(report.id), 'Zgłoszenie odrzucone')
        }}
        onCancel={() => setIsRejectOpen(false)}
      />
    </div>
  )
}
