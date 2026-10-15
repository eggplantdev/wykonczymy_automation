'use client'

import { createContext, use } from 'react'
import type { EditorActionsT } from '@/components/kosztorys/editor/editor-actions'
import { kosztorysEditorActions } from '@/components/kosztorys/editor/kosztorys-editor-actions'

// Its own context, not a field of KosztorysEditorProvider: the value is one of two module constants,
// so it never changes identity and re-renders nothing (EX-496). The kosztorys default serves the
// read-only renders, which write nothing; the editable route sets it through KosztorysEditorV2's
// required `actions` prop.
export const EditorActionsContext = createContext<EditorActionsT>(kosztorysEditorActions)

export function useEditorActions(): EditorActionsT {
  return use(EditorActionsContext)
}
