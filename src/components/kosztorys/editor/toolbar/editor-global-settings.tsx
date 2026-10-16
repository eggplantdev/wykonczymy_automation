'use client'

import { KosztorysGlobalSettings } from '@/components/kosztorys/editor/toolbar/kosztorys-global-settings'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function EditorGlobalSettings() {
  const { tree, handleGlobalCoeffChange, readOnly } = useKosztorysEditorContext()
  if (readOnly) return null
  return (
    <KosztorysGlobalSettings
      globalCoeffs={tree.globalCoeffs}
      onGlobalCoeffChange={handleGlobalCoeffChange}
    />
  )
}
