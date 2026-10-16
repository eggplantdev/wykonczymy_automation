'use client'

import { createContext, use, type ReactNode } from 'react'
import {
  useDialogToggle,
  type DialogToggleT,
} from '@/components/kosztorys/editor/actions/use-dialog-toggle'
import {
  useSavePresetAction,
  type SavePresetActionT,
} from '@/components/kosztorys/editor/actions/save-preset-action'
import {
  useSheetCompareAction,
  type SheetCompareActionT,
} from '@/components/kosztorys/editor/actions/sheet-compare-action'
import {
  useInvestorActions,
  type InvestorActionsT,
} from '@/components/kosztorys/editor/actions/investor-actions'
import {
  useWorkerActions,
  type WorkerActionsT,
} from '@/components/kosztorys/editor/actions/worker-actions'
import {
  useWorkerReportsAction,
  type WorkerReportsActionT,
} from '@/components/kosztorys/editor/actions/worker-reports-action'
import {
  useScanReportAction,
  type ScanReportActionT,
} from '@/components/kosztorys/editor/actions/scan-report-action'
import { useCleanItemTextsAction } from '@/components/kosztorys/editor/actions/clean-item-texts-action'
import { useFillTranslationsAction } from '@/components/kosztorys/editor/actions/fill-translations-action'
import type { TreeRewriteActionT } from '@/components/kosztorys/editor/actions/use-tree-rewrite-action'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ScanReportDialog } from '@/components/worker-reports/scan-report-dialog'
import { WorkerReportsDialog } from '@/components/kosztorys/editor/dialogs/worker-reports/worker-reports-dialog'
import type { WorkerReportsSeedT } from '@/lib/kosztorys/types'

type KosztorysActionsT = {
  version: DialogToggleT
  clear: DialogToggleT
  reloadPreset: DialogToggleT
  savePreset: SavePresetActionT
  sheetCompare: SheetCompareActionT
  catalogueCompare: DialogToggleT
  investor: InvestorActionsT
  worker: WorkerActionsT
  acceptanceProtocol: DialogToggleT
  workerReports: WorkerReportsActionT | undefined
  scan: ScanReportActionT
  cleanItemTexts: TreeRewriteActionT
  fillTranslations: TreeRewriteActionT
  // Either rewrite locks both: they write the same rows.
  treeRewriting: boolean
}

const KosztorysActionsContext = createContext<KosztorysActionsT | null>(null)

// DropdownMenuContent unmounts its children when the menu closes, and onSelect closes it.
export function KosztorysActionsProvider({
  children,
  workerReports: workerReportsSeed,
}: {
  children: ReactNode
  workerReports?: WorkerReportsSeedT
}) {
  const version = useDialogToggle()
  const clear = useDialogToggle()
  const reloadPreset = useDialogToggle()
  const savePreset = useSavePresetAction()
  const sheetCompare = useSheetCompareAction()
  const catalogueCompare = useDialogToggle()
  const investor = useInvestorActions()
  const worker = useWorkerActions()
  const acceptanceProtocol = useDialogToggle()
  const workerReports = useWorkerReportsAction(workerReportsSeed)
  const scan = useScanReportAction()
  const cleanItemTexts = useCleanItemTextsAction()
  const fillTranslations = useFillTranslationsAction()
  const { investmentId } = useKosztorysEditorContext()
  const value: KosztorysActionsT = {
    version,
    clear,
    reloadPreset,
    savePreset,
    sheetCompare,
    catalogueCompare,
    investor,
    worker,
    acceptanceProtocol,
    workerReports: workerReportsSeed ? workerReports : undefined,
    scan,
    cleanItemTexts,
    fillTranslations,
    treeRewriting: cleanItemTexts.pending || fillTranslations.pending,
  }

  return (
    <KosztorysActionsContext value={value}>
      {children}
      {workerReportsSeed && <WorkerReportsDialog action={workerReports} />}
      {workerReportsSeed && (
        <ScanReportDialog
          open={scan.open}
          onOpenChange={scan.setOpen}
          investmentId={investmentId}
          workers={scan.workers}
          onCreated={(reportId) => {
            workerReports.setPendingCount(workerReports.pendingCount + 1)
            workerReports.openReport(reportId)
          }}
        />
      )}
    </KosztorysActionsContext>
  )
}

export function useKosztorysActions() {
  const value = use(KosztorysActionsContext)
  if (!value) throw new Error('useKosztorysActions must be used within KosztorysActionsProvider')
  return value
}
