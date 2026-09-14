'use client'

import { KosztorysGlobalSettings } from '@/components/kosztorys/editor/toolbar/kosztorys-global-settings'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// KosztorysGlobalSettings wired to the editor context. Exists as its own component so a host that
// renders it conditionally can gate on the JSX instead of the hook — a hook can't be conditional,
// but rendering the component that calls it can.
export function EditorGlobalSettings() {
  const { tree, handleGlobalCoeffChange, readOnly } = useKosztorysEditorContext()
  // The multipliers reprice every subcontractor figure below them, so a closed investment drops the
  // controls entirely rather than showing them dead.
  if (readOnly) return null
  return (
    <KosztorysGlobalSettings
      globalCoeffs={tree.globalCoeffs}
      onGlobalCoeffChange={handleGlobalCoeffChange}
    />
  )
}
