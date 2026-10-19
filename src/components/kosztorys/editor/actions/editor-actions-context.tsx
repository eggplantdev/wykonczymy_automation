'use client'

import { createContext, use } from 'react'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import { kosztorysEditorActions } from '@/components/kosztorys/editor/actions/kosztorys-editor-actions'

// Its own context: the value is one of two module constants, so it never changes identity and
// re-renders nothing.
export const EditorActionsContext = createContext<EditorActionsT>(kosztorysEditorActions)

export function useEditorActions(): EditorActionsT {
  return use(EditorActionsContext)
}
