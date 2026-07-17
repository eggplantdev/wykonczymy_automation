'use client'

import { createContext, use, type ReactNode } from 'react'
import type { useKosztorysEditor } from '@/components/kosztorys/use-kosztorys-editor'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// Everything the editor hook owns plus the four values its caller supplies. The toolbar and its
// controls read straight from here, so KosztorysEditorBody relays none of it.
type KosztorysEditorContextT = ReturnType<typeof useKosztorysEditor> & {
  investmentId: number
  investmentName: string
  tree: KosztorysTreeT
  onOpenVersions: () => void
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
