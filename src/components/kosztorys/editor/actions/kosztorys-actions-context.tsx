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

type KosztorysActionsT = {
  version: DialogToggleT
  clear: DialogToggleT
  reloadPreset: DialogToggleT
  savePreset: SavePresetActionT
  sheetCompare: SheetCompareActionT
  catalogueCompare: DialogToggleT
  investor: InvestorActionsT
}

const KosztorysActionsContext = createContext<KosztorysActionsT | null>(null)

// An „Opcje" action is triggered by a menu item and rendered by a dialog, and those can never share a
// parent: DropdownMenuContent unmounts its children when the menu closes, and onSelect closes it. The
// state therefore lives here instead of being threaded from the menu down to both sides.
// Deliberately NOT part of KosztorysEditorProvider — only the menu and its dialogs consume this, so a
// „Udostępnij" fetch landing cannot churn the grid (the EX-496 regression).
export function KosztorysActionsProvider({ children }: { children: ReactNode }) {
  const version = useDialogToggle()
  const clear = useDialogToggle()
  const reloadPreset = useDialogToggle()
  const savePreset = useSavePresetAction()
  const sheetCompare = useSheetCompareAction()
  const catalogueCompare = useDialogToggle()
  const investor = useInvestorActions()
  const value: KosztorysActionsT = {
    version,
    clear,
    reloadPreset,
    savePreset,
    sheetCompare,
    catalogueCompare,
    investor,
  }

  return <KosztorysActionsContext value={value}>{children}</KosztorysActionsContext>
}

export function useKosztorysActions() {
  const value = use(KosztorysActionsContext)
  if (!value) throw new Error('useKosztorysActions must be used within KosztorysActionsProvider')
  return value
}
