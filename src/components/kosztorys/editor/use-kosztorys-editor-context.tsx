'use client'

import { createContext, use, type ReactNode } from 'react'
import type { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { EditorNounT } from '@/lib/kosztorys/editor-noun'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import type { MediaFileT } from '@/types/media'

// Everything the editor hook owns plus the four values its caller supplies. The toolbar and its
// controls read straight from here, so KosztorysEditorBody relays none of it.
type KosztorysEditorContextT = ReturnType<typeof useKosztorysEditor> & {
  investmentId: number
  investmentName: string
  tree: KosztorysTreeT
  // Absent in preview — the versions button lives in the toolbar, which the client render omits.
  onOpenVersions?: () => void
  // Fires after the whole tree is swapped out (version restore, sheet import) — remounts the body.
  onTreeReplaced?: () => void
  // Opens „Pobierz z arkusza Google". Owned above the toolbar because the empty-kosztorys screen
  // offers it too. Absent in preview, which renders neither trigger.
  openImport?: () => void
  hasSheet: boolean
  templatePresetId?: number
  // Derived from `templatePresetId`, and published rather than re-derived: eight controls asked
  // „== null" and six called `editorNoun` for themselves, so „what is this editor" was answered in
  // fourteen places that had to agree. Both are cheap — a boolean and one of two module constants —
  // so nothing is memoised and the value identity is the same as the literal around it.
  isWorkshop: boolean
  noun: EditorNounT
  // `undefined` = this surface has no gallery at all (the szablon workbench, both shares);
  // `[]` = the investment simply has no files yet.
  assets?: MediaFileT[]
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
