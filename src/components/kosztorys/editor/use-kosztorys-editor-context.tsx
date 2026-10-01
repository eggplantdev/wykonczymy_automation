'use client'

import { createContext, use, type ReactNode } from 'react'
import type { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { EditorNounT } from '@/lib/kosztorys/editor-noun'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// `refetch` only when the replacing action threw: its render never arrived, so the fresh tree must be
// asked for.
export type OnTreeReplacedT = (opts?: { refetch?: boolean }) => void

// Everything the editor hook owns plus the four values its caller supplies. The toolbar and its
// controls read straight from here, so KosztorysEditorBody relays none of it.
type KosztorysEditorContextT = ReturnType<typeof useKosztorysEditor> & {
  investmentId: number
  investmentName: string
  tree: KosztorysTreeT
  // Absent in preview — the versions button lives in the toolbar, which the client render omits.
  onOpenVersions?: () => void
  // Fires after the whole tree is swapped out — remounts the body.
  onTreeReplaced?: OnTreeReplacedT
  // Opens „Pobierz z arkusza Google". Owned above the toolbar because the empty-kosztorys screen
  // offers it too. Absent in preview, which renders neither trigger.
  openImport?: () => void
  hasSheet: boolean
  // Published rather than re-derived: eight controls asked „is this a szablon" and six called
  // `editorNoun` for themselves, so „what is this editor" was answered in fourteen places that had to
  // agree. Both are cheap — a boolean and one of two module constants — so nothing is memoised.
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
