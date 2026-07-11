'use client'

import { createContext, useContext } from 'react'

// Lets FormFooter render the dialog's "keep open after save" checkbox inline with the submit
// button, without threading the setter through every form. FormDialog owns the state and the
// submit value flow stays via the existing children args — this context is UI-only.
type KeepOpenContextT = {
  keepOpen: boolean
  setKeepOpen: (value: boolean) => void
}

const KeepOpenContext = createContext<KeepOpenContextT | null>(null)

export const KeepOpenProvider = KeepOpenContext.Provider

// null when a form is rendered outside a keep-open-capable dialog — FormFooter omits the checkbox.
export function useKeepOpen(): KeepOpenContextT | null {
  return useContext(KeepOpenContext)
}
