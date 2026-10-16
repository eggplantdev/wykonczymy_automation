'use client'

import { createContext, use, type ReactNode } from 'react'
import type { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { EditorNounT } from '@/lib/kosztorys/editor-noun'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// `refetch` when the replacing action's render never arrived — it threw, or was refused as stale — so
// the fresh tree must be asked for. `stale`: the refusal said the grid's rows are behind.
export type OnTreeReplacedT = (opts?: { refetch?: boolean; stale?: boolean }) => void

type KosztorysEditorContextT = ReturnType<typeof useKosztorysEditor> & {
  investmentId: number
  investmentName: string
  tree: KosztorysTreeT
  onOpenVersions?: () => void
  onTreeReplaced?: OnTreeReplacedT
  openImport?: () => void
  hasSheet: boolean
  isTemplate: boolean
  isTrashed: boolean
  noun: EditorNounT
}

const KosztorysEditorContext = createContext<KosztorysEditorContextT | null>(null)

export function KosztorysEditorProvider({
  editor,
  children,
}: {
  editor: KosztorysEditorContextT
  children: ReactNode
}) {
  return <KosztorysEditorContext value={editor}>{children}</KosztorysEditorContext>
}

export function useKosztorysEditorContext(): KosztorysEditorContextT {
  const editor = use(KosztorysEditorContext)
  if (!editor) {
    throw new Error('useKosztorysEditorContext must be used within KosztorysEditorProvider')
  }
  return editor
}
